import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Star, Hash, ArrowRight, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { FirebaseUser } from '../types';

interface WelcomeOnboardingProps {
  show: boolean;
  user: FirebaseUser | null;
  onGoogleSignIn: () => void;
  onViewSpots: () => void;
  onFinish: () => void;
}

// First-run only (see the localStorage flag in App.tsx) - 3 slides
// introducing the app's core loop and nudging toward the two things that
// make the community data useful: leaving reviews (real feature, see
// SpotDetail/EventDetail) and signing in with Google instead of staying
// guest. Slide 2's "cuéntale a la comunidad" points at the existing
// review/rating flow rather than a separate "report status" feature,
// since that's what actually exists today.
const SLIDES = [
  {
    icon: MapPin,
    title: 'Descubre spots urbanos',
    description: 'Explora el mapa y encuentra skateparks, rutas street y eventos de skate, BMX y parkour cerca de ti.',
  },
  {
    icon: Star,
    title: 'Cuéntale a la comunidad cómo están',
    description: 'Deja tu reseña en cada spot: estado del piso, obstáculos, qué tan concurrido está. Así el próximo rider sabe qué esperar antes de ir.',
  },
  {
    icon: Hash,
    title: 'Comparte y únete a la comunidad',
    description: 'Sube tus clips con #hashtags al feed de Comunidad, y crea una cuenta con Google para subir spots, dejar reseñas y guardar favoritos.',
  },
];

export const WelcomeOnboarding: React.FC<WelcomeOnboardingProps> = ({ show, user, onGoogleSignIn, onViewSpots, onFinish }) => {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;
  const Icon = SLIDES[slide].icon;

  const handleClose = () => {
    setSlide(0);
    onFinish();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[6000] bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-sm bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl light:bg-white light:border-transparent light:shadow-none"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white transition-colors light:text-black"
              title="Omitir"
            >
              <X className="w-4 h-4" />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="text-center pt-4"
              >
                <div className="w-16 h-16 rounded-full bg-[#a3ff12]/10 border border-[#a3ff12]/20 flex items-center justify-center mx-auto mb-5 light:bg-white light:border-black">
                  <Icon className="w-7 h-7 text-[#a3ff12] light:text-[#96ab79]" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight mb-2 light:text-black">{SLIDES[slide].title}</h2>
                <p className="text-sm text-slate-400 leading-relaxed light:text-slate-600">{SLIDES[slide].description}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-center gap-1.5 mt-6 mb-5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={cn("h-1.5 rounded-full transition-all", i === slide ? "w-6 bg-[#a3ff12] light:bg-[#96ab79]" : "w-1.5 bg-slate-700 light:bg-slate-300")}
                />
              ))}
            </div>

            {isLast && !user && (
              <button
                onClick={() => { onGoogleSignIn(); handleClose(); }}
                className="w-full bg-white text-black py-3 rounded-2xl font-bold flex items-center justify-center gap-2 mb-2.5 active:scale-95 transition-all light:border light:border-black"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
                <span className="text-xs">Crear cuenta con Google</span>
              </button>
            )}

            <div className="flex items-center gap-2.5">
              {slide === 0 && (
                <button
                  onClick={() => { onViewSpots(); handleClose(); }}
                  className="flex-1 border border-slate-700 text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all light:border-black light:text-black"
                >
                  Ver spots
                </button>
              )}
              <button
                onClick={() => (isLast ? handleClose() : setSlide(s => s + 1))}
                className="flex-1 bg-[#a3ff12] text-black py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all light:bg-[#96ab79] light:text-white"
              >
                <span className="text-xs uppercase tracking-widest">{isLast ? (user ? 'Empezar' : 'Explorar como invitado') : 'Siguiente'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
