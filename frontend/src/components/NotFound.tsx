import { SkaterLogo } from './SkaterLogo';

interface NotFoundProps {
  /** Ruta que se pidió. Se muestra para distinguir un enlace roto de un fallo nuestro. */
  ruta?: string;
}

/**
 * Pantalla 404 dentro de la aplicación.
 *
 * Existe en paralelo a public/404.html a propósito: aquella la sirve el
 * servidor antes de que React arranque (enlaces profundos, recargas), y esta
 * la muestra la aplicación ya cargada. Las dos comparten identidad visual;
 * si cambia la paleta en index.css, hay que tocar también el HTML estático.
 */
export const NotFound = ({ ruta }: NotFoundProps) => {
  const rutaMostrada = ruta ?? `${window.location.pathname}${window.location.search}`;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-50 px-6 overflow-hidden">
      {/* Rejilla de mapa desvanecida hacia los bordes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(186,244,19,.07) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(186,244,19,.07) 0 1px, transparent 1px 48px)',
          maskImage: 'radial-gradient(75% 60% at 50% 45%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(75% 60% at 50% 45%, #000 0%, transparent 75%)',
        }}
      />

      <main className="relative w-full max-w-xl text-center">
        <div className="inline-flex items-center gap-2.5 mb-10">
          <SkaterLogo />
          <span className="font-extrabold text-[17px] tracking-tight">
            URBAN<span className="text-[#baf413]">FLOW</span>
          </span>
        </div>

        <p
          className="font-mono font-bold text-[#baf413] m-0 leading-[0.85] tracking-[-0.05em] text-[clamp(84px,22vw,168px)]"
          style={{ textShadow: '0 0 60px rgba(186,244,19,.28)' }}
        >
          404
        </p>

        <p className="font-mono text-[11px] font-medium tracking-[0.24em] uppercase text-slate-400 mt-5">
          Spot no encontrado
        </p>

        <h1 className="text-[clamp(24px,5vw,32px)] font-extrabold tracking-tight mt-3.5 text-balance">
          Esta dirección no está en el mapa
        </h1>

        <p className="text-slate-400 text-base leading-relaxed mt-3.5 mx-auto max-w-[42ch]">
          El enlace que seguiste no lleva a ningún sitio. Puede que el spot se
          haya retirado, o que la dirección esté mal escrita.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-9">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#baf413] text-[#0a0f1c] font-bold text-[15px] no-underline transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#baf413] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Volver al mapa
          </a>
        </div>

        <p className="mt-9 font-mono text-xs text-slate-500 break-all">
          Ruta solicitada: <span className="text-slate-400">{rutaMostrada}</span>
        </p>
      </main>
    </div>
  );
};
