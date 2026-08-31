import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Spot } from '../types';
import { CATEGORIES } from '../constants';
import { Coordenada, distanciaAlUsuario } from '../lib/geo';

interface PopupSpotProps {
  spot: Spot;
  /** Posición del usuario, para mostrar la distancia real. Null si no la sabemos. */
  ubicacionUsuario: Coordenada | null;
  onComoLlegar: (spot: Spot) => void;
  onVerDetalle: (spot: Spot) => void;
}


/** Convierte el array JSON que guarda `category` en nombres legibles. */
function nombresDeCategoria(category: string): string[] {
  try {
    const ids = JSON.parse(category);
    if (!Array.isArray(ids)) return [String(category)];
    return ids.map((id) => CATEGORIES.find((c) => c.id === id)?.name ?? String(id));
  } catch {
    return [category];
  }
}

/**
 * Contenido del globo que se abre al pulsar un marcador del mapa.
 *
 * Deliberadamente corto: nombre, dónde está, a qué distancia y para qué sirve.
 * Lo demás vive en la ficha completa del spot, a un toque de aquí.
 */
export const PopupSpot = ({
  spot,
  ubicacionUsuario,
  onComoLlegar,
  onVerDetalle,
}: PopupSpotProps) => {
  const distancia = distanciaAlUsuario({ lat: spot.lat, lng: spot.lng }, ubicacionUsuario);
  const categorias = nombresDeCategoria(spot.category);

  return (
    <div className="w-[260px] bg-slate-900 text-slate-50 rounded-2xl overflow-hidden border border-slate-700">
      <button
        type="button"
        onClick={() => onVerDetalle(spot)}
        className="block w-full text-left"
      >
        {/* Igual que en la tarjeta: sin foto propia, marcador, no stock. */}
        <div className="relative h-28 w-full overflow-hidden bg-slate-800 flex items-center justify-center">
          {spot.image_url ? (
            <img
              src={spot.image_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <MapPin className="w-8 h-8 text-slate-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
        </div>

        <div className="px-3.5 pt-3">
          <h3 className="font-bold text-[15px] leading-tight">{spot.name}</h3>

          {(spot.location_name || distancia) && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {spot.location_name}
                {spot.location_name && distancia ? ' · ' : ''}
                {distancia}
              </span>
            </p>
          )}

          {spot.description && (
            <p className="text-xs text-slate-400 leading-relaxed mt-2 line-clamp-3">
              {spot.description}
            </p>
          )}

          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {categorias.map((nombre) => (
                <span
                  key={nombre}
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400"
                >
                  {nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      <div className="p-3.5 pt-3">
        <button
          type="button"
          onClick={() => onComoLlegar(spot)}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-black font-bold text-sm py-2.5 rounded-full active:scale-95 transition-transform"
        >
          <Navigation className="w-4 h-4" />
          Cómo llegar
        </button>
      </div>
    </div>
  );
};
