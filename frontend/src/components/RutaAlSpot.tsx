import { AlertTriangle, Bike, Bus, Car, Footprints, Loader2, MapPin, Navigation, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Spot } from '../types';
import type { Coordenada } from '../lib/geo';
import type { ModoViaje, ResumenRuta } from '../hooks/useRuta';

interface RutaAlSpotProps {
  spot: Spot;
  origen: Coordenada | null;
  modo: ModoViaje;
  resumen: ResumenRuta | null;
  calculando: boolean;
  error: string | null;
  onCambiarModo: (modo: ModoViaje) => void;
  onCerrar: () => void;
}

const MODOS: { id: ModoViaje; icono: typeof Car; etiqueta: string }[] = [
  { id: 'DRIVING', icono: Car, etiqueta: 'En auto' },
  { id: 'BICYCLING', icono: Bike, etiqueta: 'En bici' },
  { id: 'WALKING', icono: Footprints, etiqueta: 'Caminando' },
  { id: 'TRANSIT', icono: Bus, etiqueta: 'Transporte público' },
];

/**
 * Panel de "Cómo llegar": modo de viaje, resumen y los tramos paso a paso.
 *
 * La línea de la ruta la dibuja `useRuta` directamente sobre el mapa; aquí solo
 * se presenta lo que ese cálculo devolvió.
 */
export const RutaAlSpot = ({
  spot,
  origen,
  modo,
  resumen,
  calculando,
  error,
  onCambiarModo,
  onCerrar,
}: RutaAlSpotProps) => {
  // Abrir la app de mapas del teléfono es lo único que puede dar navegación por
  // voz de verdad; reimplementarla dentro de urbanFlow no tendría sentido.
  const urlNavegacion = origen
    ? `https://www.google.com/maps/dir/?api=1&origin=${origen.lat},${origen.lng}` +
      `&destination=${spot.lat},${spot.lng}&travelmode=${modo.toLowerCase()}`
    : `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-50">
      {/* Origen y destino */}
      <div className="p-4 pb-3 shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              <span className="text-sm text-slate-400 truncate">
                {origen ? 'Tu ubicación' : 'Ubicación no disponible'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
              <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm truncate">{spot.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar la ruta"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modo de viaje */}
      <div className="px-4 shrink-0">
        <div className="flex border-b border-slate-800">
          {MODOS.map(({ id, icono: Icono, etiqueta }) => (
            <button
              key={id}
              type="button"
              onClick={() => onCambiarModo(id)}
              aria-label={etiqueta}
              aria-pressed={modo === id}
              className={cn(
                'flex-1 flex items-center justify-center py-3 border-b-2 -mb-px transition-colors',
                modo === id
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              <Icono className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Resumen y tramos */}
      <div className="flex-1 overflow-y-auto">
        {calculando && (
          <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Calculando la ruta…</span>
          </div>
        )}

        {!calculando && error && (
          <div
            role="alert"
            className="m-4 flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3.5"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 leading-relaxed">{error}</p>
          </div>
        )}

        {!calculando && !error && resumen && (
          <>
            <div className="px-4 py-4">
              <p className="text-3xl font-extrabold tracking-tight">
                {resumen.duracion}{' '}
                <span className="text-slate-400 text-lg font-medium">({resumen.distancia})</span>
              </p>
              <p className="text-sm text-slate-500 mt-0.5">La ruta más rápida</p>
            </div>

            {resumen.tramos.length > 0 && (
              <ol className="px-4 pb-4 space-y-0">
                {resumen.tramos.map((tramo, i) => (
                  <li
                    key={`${i}-${tramo.instruccion}`}
                    className="flex gap-3.5 py-3 border-b border-slate-800/70 last:border-b-0"
                  >
                    <span className="font-mono text-xs text-slate-600 pt-0.5 w-5 shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{tramo.instruccion}</p>
                      {(tramo.distancia || tramo.duracion) && (
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                          {[tramo.distancia, tramo.duracion].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      {/* Acción */}
      <div className="p-4 shrink-0 border-t border-slate-800">
        <a
          href={urlNavegacion}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-black font-bold py-4 rounded-full active:scale-95 transition-transform"
        >
          <Navigation className="w-5 h-5" />
          Iniciar navegación
        </a>
      </div>
    </div>
  );
};
