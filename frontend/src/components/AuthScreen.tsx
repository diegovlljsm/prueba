import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Users } from 'lucide-react';
import { SkaterLogo } from './SkaterLogo';

interface AuthScreenProps {
  show: boolean;
  isLoadingAuth: boolean;
  onGoogleSignIn: () => void;
  onContinueAsGuest: () => void;
}

export const AuthScreen = ({ show, isLoadingAuth, onGoogleSignIn, onContinueAsGuest }: AuthScreenProps) => {
  return (
    <AnimatePresence>
      {show && !isLoadingAuth && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden"
        >
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#a3ff12]/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
          </div>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 w-full max-w-md text-center"
          >
            <div className="flex justify-center mb-8">
              <div className="bg-[#a3ff12] p-6 rounded-[32px] shadow-2xl shadow-[#a3ff12]/20 rotate-12">
                <SkaterLogo />
              </div>
            </div>

            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter leading-none uppercase">
              Urban<span className="text-[#a3ff12]">Flow</span>
            </h1>
            <p className="text-slate-400 text-lg mb-12 font-medium">
              Explora, graba y comparte los mejores spots de la ciudad.
            </p>

            <div className="space-y-4">
              <button
                onClick={onGoogleSignIn}
                className="w-full bg-white text-black py-5 rounded-[28px] font-black flex items-center justify-center gap-4 shadow-xl hover:bg-slate-100 active:scale-95 transition-all group"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                <span className="text-lg">Continuar con Google</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>

              <div className="flex items-center gap-4 py-4">
                <div className="h-[1px] flex-1 bg-white/10" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">o</span>
                <div className="h-[1px] flex-1 bg-white/10" />
              </div>

              <button
                onClick={onContinueAsGuest}
                className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black flex items-center justify-center gap-3 border border-white/5 hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Users className="w-6 h-6 text-slate-400" />
                <span className="text-lg">Continuar como Invitado</span>
              </button>
            </div>

            <p className="mt-12 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed">
              Al continuar, aceptas nuestros <br />
              <span className="text-slate-400">Términos de Servicio</span> y <span className="text-slate-400">Política de Privacidad</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
