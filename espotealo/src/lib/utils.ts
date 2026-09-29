import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SyntheticEvent } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Self-contained placeholder image (no network dependency) used whenever a spot/post
// has no photo yet, or its photo URL fails to load.
export const PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a0f02"/><stop offset="100%" stop-color="#16210a"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="255" r="70" fill="none" stroke="#a3ff12" stroke-opacity="0.5" stroke-width="4"/><path d="M368 285l32-60 32 60z" fill="none" stroke="#a3ff12" stroke-opacity="0.5" stroke-width="4" stroke-linejoin="round"/><text x="400" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="3" fill="#a3ff12" fill-opacity="0.6">SIN FOTO AÚN</text></svg>`
)}`;

export function handleImageError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_IMAGE) {
    img.src = PLACEHOLDER_IMAGE;
  }
}

// Un createdAt puede llegar como string ISO (datos mock del servidor), como
// Timestamp de Firestore ya serializado a JSON ({_seconds}) o como Timestamp
// vivo del SDK (.toDate()). new Date() sólo entiende el primero, así que sin
// esto los cálculos sobre fechas de Firestore dan NaN en silencio.
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  let date: Date;
  if (typeof value === "string") date = new Date(value);
  else if (typeof (value as any)?.toDate === "function") date = (value as any).toDate();
  else if (typeof (value as any)?._seconds === "number") date = new Date((value as any)._seconds * 1000);
  else return null;
  return isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";

  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Hace 1 día";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;
  const months = Math.floor(diffDays / 30);
  if (months <= 1) return "Hace 1 mes";
  return `Hace ${months} meses`;
}

// `category` viene como texto plano en los spots del catastro ("skate") y como
// JSON en los que sube un usuario ('["bmx","skate"]').
function categoryIds(category?: string | null): string[] {
  if (!category) return [];
  try {
    const parsed = JSON.parse(category);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return category.split(",").map(c => c.trim()).filter(Boolean);
  }
}

// Spots relacionados con el que se está viendo: primero los que comparten
// disciplina y, dentro de cada grupo, los más cercanos. No hay ranking
// editorial ni recomendaciones inventadas - es sólo proximidad y disciplina
// calculadas sobre los spots que ya están cargados.
export function getRelatedSpots<T extends { id: string; lat: number; lng: number; category?: string }>(
  current: T,
  all: T[],
  limit = 10
): T[] {
  const currentIds = new Set(categoryIds(current.category));
  return all
    .filter(s => s.id !== current.id)
    .map(s => ({
      spot: s,
      sharesDiscipline: categoryIds(s.category).some(id => currentIds.has(id)),
      distanceKm: getDistanceKm(current.lat, current.lng, s.lat, s.lng),
    }))
    .sort((a, b) =>
      a.sharesDiscipline === b.sharesDiscipline
        ? a.distanceKm - b.distanceKm
        : Number(b.sharesDiscipline) - Number(a.sharesDiscipline)
    )
    .slice(0, limit)
    .map(x => x.spot);
}

// Eventos que ocurren cerca de un spot. No existe una relación spot-evento en
// los datos (nadie declara "este evento es en este skatepark"), así que el
// vínculo es puramente geográfico: lo que cayó dentro de maxKm. Los que aún no
// se realizan van primero; después los pasados, que siguen siendo historia del
// lugar.
export function getNearbyEvents<T extends { lat: number; lng: number; available?: boolean }>(
  spot: { lat: number; lng: number },
  events: T[],
  maxKm = 20,
  limit = 8
): T[] {
  return events
    .map(event => ({ event, distanceKm: getDistanceKm(spot.lat, spot.lng, event.lat, event.lng) }))
    .filter(x => x.distanceKm <= maxKm)
    .sort((a, b) => {
      const aUpcoming = a.event.available !== false;
      const bUpcoming = b.event.available !== false;
      return aUpcoming === bUpcoming ? a.distanceKm - b.distanceKm : Number(bUpcoming) - Number(aUpcoming);
    })
    .slice(0, limit)
    .map(x => x.event);
}

// Spots que quedan cerca de un punto - el reverso de getNearbyEvents, usado
// en el detalle de un evento para responder "ya que voy, ¿dónde puedo patinar
// por aquí?". Sólo distancia: un evento no tiene disciplina con la que
// emparejar spots.
export function getNearbySpots<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  spots: T[],
  maxKm = 20,
  limit = 10
): T[] {
  return spots
    .map(spot => ({ spot, distanceKm: getDistanceKm(origin.lat, origin.lng, spot.lat, spot.lng) }))
    .filter(x => x.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(x => x.spot);
}

// Los eventos guardan su categoría como id en inglés ("contest", "workshop").
// Mostrarlo crudo dejaba etiquetas como "CONTEST" en la interfaz; esto es sólo
// el nombre visible, el valor almacenado y el filtrado siguen usando el id.
const EVENT_CATEGORY_LABELS: Record<string, string> = {
  jam: "Jam",
  contest: "Campeonato",
  workshop: "Taller",
  ciclismo: "Ciclismo",
};

export function eventCategoryLabel(category?: string | null): string {
  if (!category) return "Evento";
  return EVENT_CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

// open_hours es texto libre del catastro ("Lunes a Domingo, 7:00 AM - 9:00 PM",
// "24 horas", "desde las 9:00 AM", y en la mayoría de los spots simplemente
// null). Sólo devolvemos un estado cuando el texto trae un rango reconocible:
// si no se puede saber, devuelve null y la UI omite la etiqueta en vez de
// afirmar que un spot está abierto o cerrado sin dato que lo respalde.
export function getOpenState(openHours?: string | null, now: Date = new Date()): 'abierto' | 'cerrado' | null {
  if (!openHours) return null;
  const text = openHours.toLowerCase();
  if (text.includes("24 horas")) return "abierto";

  const match = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:-|–|a)\s*(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!match) return null;

  const to24 = (hour: number, meridiem?: string) => {
    if (!meridiem) return hour;
    if (meridiem === "pm" && hour !== 12) return hour + 12;
    if (meridiem === "am" && hour === 12) return 0;
    return hour;
  };
  const start = to24(Number(match[1]), match[3]) * 60 + Number(match[2]);
  const end = to24(Number(match[4]), match[6]) * 60 + Number(match[5]);
  const current = now.getHours() * 60 + now.getMinutes();
  // Un rango que cruza medianoche (22:00-02:00) se evalúa al revés.
  const open = end > start ? current >= start && current < end : current >= start || current < end;
  return open ? "abierto" : "cerrado";
}

export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

