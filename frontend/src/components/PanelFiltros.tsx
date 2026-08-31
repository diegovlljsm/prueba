import React from 'react';
import { useEffect, useState } from 'react';
import { ChevronLeft, Image as ImageIcon, MapPin } from 'lucide-react';
import { CATEGORIES } from '../constants';
import { cn } from '../lib/utils';

export interface Filtros {
  /** Ids de categoría activas. Vacío = todas. */
  categorias: string[];
  /** Radio en metros desde el usuario. null = sin límite de distancia. */
  radioMetros: number | null;
  soloConFoto: boolean;
}

export const FILTROS_VACIOS: Filtros = {
  categorias: [],
  radioMetros: null,
  soloConFoto: false,
};

export function hayFiltrosActivos(f: Filtros): boolean {
  return f.categorias.length > 0 || f.radioMetros !== null || f.soloConFoto;
}

const RADIOS: { etiqueta: string; metros: number | null }[] = [
  { etiqueta: '1 km', metros: 1_000 },
  { etiqueta: '5 km', metros: 5_000 },
  { etiqueta: '10 km', metros: 10_000 },
  { etiqueta: 'Cualquiera', metros: null },
];

interface PanelFiltrosProps {
  filtros: Filtros;
  /** Cuántos spots quedarían con los filtros que se están editando. */
  contarResultados: (f: Filtros) => number;
  /** Sin ubicación del usuario no tiene sentido filtrar por distancia. */
  hayUbicacion: boolean;
  onAplicar: (f: Filtros) => void;
  onCerrar: () => void;
}

/**
 * Panel de filtros de la maqueta.
 *
 * Solo filtra por lo que existe de verdad en el modelo de datos: deporte,
 * distancia y si el spot tiene foto. La maqueta muestra además nivel de
 * dificultad, afluencia y calificación mínima; esos campos todavía no existen
 * en la base, y ofrecer un filtro que no filtra nada es peor que no ofrecerlo.
 *
 * Los cambios se editan sobre un borrador y solo salen al pulsar "Aplicar":
 * recalcular el mapa en cada toque haría parpadear los marcadores.
 */
export const PanelFiltros = ({
  filtros,
  contarResultados,
  hayUbicacion,
  onAplicar,
  onCerrar,
}: PanelFiltrosProps) => {
  const [borrador, setBorrador] = useState<Filtros>(filtros);

  useEffect(() => setBorrador(filtros), [filtros]);

  const alternarCategoria = (id: string) =>
    setBorrador((b) => ({
      ...b,
      categorias: b.categorias.includes(id)
        ? b.categorias.filter((c) => c !== id)
        : [...b.categorias, id],
    }));

  const total = contarResultados(borrador);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between px-4 py-3.5 shrink-0 border-b border-slate-800">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Volver"
          className="p-1.5 -ml-1.5 rounded-full text-slate-300 hover:text-slate-50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-base">Filtros</h2>
        <button
          type="button"
          onClick={() => setBorrador(FILTROS_VACIOS)}
          className="text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Limpiar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
        {/* Tipo de spot */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Tipo de spot
          </h3>
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map((categoria) => {
              const activa = borrador.categorias.includes(categoria.id);
              return (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => alternarCategoria(categoria.id)}
                  aria-pressed={activa}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border transition-colors',
                    activa
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  )}
                >
                  {categoria.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wide leading-none text-center px-1">
                    {categoria.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Distancia */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Distancia
          </h3>
          {hayUbicacion ? (
            <div className="flex flex-wrap gap-2">
              {RADIOS.map(({ etiqueta, metros }) => {
                const activo = borrador.radioMetros === metros;
                return (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => setBorrador((b) => ({ ...b, radioMetros: metros }))}
                    aria-pressed={activo}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-bold border transition-colors',
                      activo
                        ? 'border-emerald-500 bg-emerald-500 text-black'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    )}
                  >
                    {etiqueta}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
              <MapPin className="w-4 h-4 shrink-0" />
              Concede el permiso de ubicación para filtrar por distancia.
            </p>
          )}
        </section>

        {/* Contenido */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Contenido
          </h3>
          <button
            type="button"
            onClick={() => setBorrador((b) => ({ ...b, soloConFoto: !b.soloConFoto }))}
            aria-pressed={borrador.soloConFoto}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-colors',
              borrador.soloConFoto
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
            )}
          >
            <ImageIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Solo spots con foto</span>
          </button>
        </section>
      </div>

      <div className="p-4 shrink-0 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onAplicar(borrador)}
          disabled={total === 0}
          className="w-full bg-emerald-500 text-black font-black py-4 rounded-full active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
        >
          {total === 0
            ? 'Ningún spot coincide'
            : `Mostrar ${total} ${total === 1 ? 'spot' : 'spots'}`}
        </button>
      </div>
    </div>
  );
};
