/**
 * Utilidades geográficas del cliente.
 *
 * Ojo con el alcance: esto sirve para *mostrar* distancias de spots que el
 * servidor ya devolvió. Filtrar por cercanía es trabajo del backend, que lo
 * hace con PostGIS y un índice espacial (`GET /api/spots?near=lng,lat&radius=`).
 * Calcular distancias en JavaScript sobre el array completo funciona con
 * cincuenta spots y deja de funcionar con cinco mil.
 */

export interface Coordenada {
  lat: number;
  lng: number;
}

const RADIO_TIERRA_M = 6_371_000;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/**
 * Distancia en metros entre dos puntos por la fórmula del haversine.
 * Asume la Tierra esférica: el error frente al elipsoide es de un 0,3% como
 * mucho, irrelevante para decir "a 2,3 km".
 */
export function distanciaEnMetros(a: Coordenada, b: Coordenada): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

/** "850 m" · "2,3 km" · "14 km". Sistema métrico, que es el de Chile. */
export function formatearDistancia(metros: number): string {
  if (!Number.isFinite(metros)) return '';
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  const km = metros / 1000;
  return km < 10
    ? `${km.toFixed(1).replace('.', ',')} km`
    : `${Math.round(km)} km`;
}

/** "8 min" · "1 h 12 min". */
export function formatearDuracion(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return '';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/**
 * Distancia de un spot al usuario, ya formateada. Devuelve null si todavía no
 * sabemos dónde está el usuario, para que la interfaz no muestre un número
 * inventado desde el centro de la ciudad.
 */
export function distanciaAlUsuario(
  spot: Coordenada,
  usuario: Coordenada | null
): string | null {
  if (!usuario) return null;
  return formatearDistancia(distanciaEnMetros(usuario, spot));
}

/** Quita las etiquetas HTML que trae Google en las instrucciones de cada tramo. */
export function limpiarInstruccion(html: string): string {
  return html
    .replace(/<div[^>]*>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
