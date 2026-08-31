import React from 'react';
import { MapPin } from 'lucide-react';
import { Spot } from '../types';
import { CATEGORIES } from '../constants';
import { Coordenada, distanciaAlUsuario } from '../lib/geo';
import { cn } from '../lib/utils';

interface TarjetaSpotProps {
  spot: Spot;
  ubicacionUsuario: Coordenada | null;
  onSelect: (spot: Spot) => void;
  /** Marca la fila como activa cuando su spot es el abierto en el mapa. */
  activo?: boolean;
}

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
 * Fila de spot de la maqueta: miniatura, nombre, dónde está y a qué distancia.
 *
 * En la maqueta cada fila lleva también una valoración con estrellas. Aquí no
 * se pinta ninguna porque todavía no existen reseñas en el modelo de datos, y
 * un 4,8 de adorno sería un dato falso en pantalla. Cuando exista FEAT-012,
 * entra en el hueco que deja `distancia`.
 */
export const TarjetaSpot = ({
  spot,
  ubicacionUsuario,
  onSelect,
  activo = false,
}: TarjetaSpotProps) => {
  const distancia = distanciaAlUsuario({ lat: spot.lat, lng: spot.lng }, ubicacionUsuario);
  const categorias = nombresDeCategoria(spot.category);

  return (
    <button
      type="button"
      onClick={() => onSelect(spot)}
      aria-current={activo ? 'true' : undefined}
      className={cn(
        'w-full flex gap-3 p-2.5 rounded-2xl text-left transition-colors group',
        'border border-transparent hover:bg-slate-800/70 hover:border-slate-700',
        activo && 'bg-slate-800 border-slate-700'
      )}
    >
      {/* Sin foto propia se pinta un marcador, no una imagen de stock: una
          foto de otro skatepark haría pasar por real algo que no lo es. */}
      <div className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center">
        {spot.image_url ? (
          <img
            src={spot.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <MapPin className="w-6 h-6 text-slate-600" />
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="font-bold text-[15px] leading-tight text-slate-100 line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {spot.name}
        </h3>

        {spot.location_name && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{spot.location_name}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          {distancia && (
            <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
              <MapPin className="w-3 h-3" />
              {distancia}
            </span>
          )}
          {categorias.slice(0, 2).map((nombre) => (
            <span
              key={nombre}
              className="text-[10px] font-bold uppercase tracking-wide text-emerald-500/90"
            >
              {nombre}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};
