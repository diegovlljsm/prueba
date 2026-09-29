import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2, ArrowRight, Users, User, Lock, Eye } from 'lucide-react';
import { SkaterLogo } from './SkaterLogo';

interface AuthScreenProps {
  show: boolean;
  isLoadingAuth: boolean;
  /** Hay un acceso en curso: bloquea el botón para no abrir dos ventanas. */
  isSigningIn?: boolean;
  /** Mensaje legible cuando el acceso falla. Null si no hay error. */
  authError?: string | null;
  onGoogleSignIn: () => void;
  onContinueAsGuest: () => void;
}

export const AuthScreen = ({
  show,
  isLoadingAuth,
  isSigningIn = false,
  authError = null,
  onGoogleSignIn,
  onContinueAsGuest,
}: AuthScreenProps) => {
  return (
    <AnimatePresence>
      {show && !isLoadingAuth && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 overflow-hidden bg-slate-950"
        >
          {/* Background video (looping, muted) + dark overlay for text contrast + neon glow atmosphere */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <video
              src="/video/auth-bg.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
            <div className="absolute top-[-15%] left-[-15%] w-[55%] h-[45%] bg-[#a3ff12]/15 blur-[110px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-15%] w-[60%] h-[50%] bg-fuchsia-500/20 blur-[120px] rounded-full" />
            <div className="absolute top-[30%] right-[-10%] w-[35%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
          </div>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 w-full max-w-md text-center bg-slate-950/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-5 shadow-2xl light:bg-white light:border-black light:shadow-none"
          >
            <div className="flex justify-center mb-3">
              <SkaterLogo size="lg" className="shadow-2xl shadow-[#a3ff12]/30 light:shadow-none" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-1.5 tracking-tighter leading-none uppercase light:text-black">
              Urban<span className="text-[#a3ff12] light:text-[#96ab79]">Flow</span>
            </h1>
            <p className="text-slate-400 text-xs mb-5 font-medium leading-relaxed light:text-slate-600">
              Explora, graba y comparte los mejores spots de la ciudad.
            </p>

            <div className="space-y-2.5">
              {/* Email/password login - visual preview only, not wired up yet.
                  Inputs and button are disabled on purpose. */}
              <div className="space-y-2 opacity-50 pointer-events-none select-none" aria-hidden="true">
                <p className="text-[10px] font-bold text-[#a3ff12] uppercase tracking-widest text-left light:text-[#96ab79]">Ingresa con tu cuenta</p>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
                  <input
                    disabled
                    placeholder="Usuario o correo electrónico"
                    className="w-full bg-slate-900/70 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-500 cursor-not-allowed light:bg-white light:border-black light:text-black"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
                  <input
                    disabled
                    type="password"
                    placeholder="Contraseña"
                    className="w-full bg-slate-900/70 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder:text-slate-500 cursor-not-allowed light:bg-white light:border-black light:text-black"
                  />
                  <Eye className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
                </div>
                <p className="text-[10px] font-semibold text-[#a3ff12] text-right light:text-[#96ab79]">¿Olvidaste tu contraseña?</p>
                <button
                  disabled
                  className="w-full bg-[#a3ff12] text-black py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-not-allowed light:bg-[#96ab79] light:text-white"
                >
                  <span className="text-xs">Iniciar sesión</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest light:text-slate-600">Próximamente</p>
              </div>

              {/* El acceso puede fallar por configuración del proyecto o por un
                  bloqueo del navegador. Antes eso solo se veía en la consola y
                  el botón parecía muerto. */}
              {authError && (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2.5 text-left bg-red-500/10 border border-red-500/25 rounded-2xl px-3.5 py-3"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">{authError}</p>
                </div>
              )}

              <button
                onClick={onGoogleSignIn}
                disabled={isSigningIn}
                aria-busy={isSigningIn}
                className="w-full bg-white text-black py-2.5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-slate-100 active:scale-95 transition-all group light:border light:border-black light:shadow-none disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Conectando con Google…</span>
                  </>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                    <span className="text-xs">Continuar con Google</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 py-0.5">
                <div className="h-[1px] flex-1 bg-white/10 light:bg-black" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest light:text-black">o continúa con</span>
                <div className="h-[1px] flex-1 bg-white/10 light:bg-black" />
              </div>

              <button
                onClick={onContinueAsGuest}
                className="w-full bg-slate-900/80 text-white py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2.5 border border-white/10 hover:bg-slate-800 active:scale-95 transition-all group light:bg-white light:text-black light:border-black light:hover:bg-slate-50"
              >
                <Users className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                <span className="text-xs">Continuar como Invitado</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            </div>

            <p className="mt-5 text-[10px] text-slate-500 font-semibold leading-relaxed light:text-slate-600">
              Al continuar, aceptas nuestros<br />
              <span className="text-[#a3ff12] light:text-[#96ab79]">Términos de Servicio</span> y <span className="text-[#a3ff12] light:text-[#96ab79]">Política de Privacidad</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
