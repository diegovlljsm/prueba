import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface EntryTransitionProps {
  show: boolean;
  onFinish: () => void;
}

// Plays once right after the user enters the app (currently wired to guest
// login only, per request - extend to Google sign-in later if wanted).
// Just the wordmark scaling in over a light gray gradient (matches the
// brand's light-theme background), then a short hold before revealing the
// map. The intro clip that used to play here now lives behind the login
// screen instead (see AuthScreen.tsx).
const HOLD_MS = 1400;

export const EntryTransition: React.FC<EntryTransitionProps> = ({ show, onFinish }) => {
  const holdTimeout = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    if (show) {
      holdTimeout.current = setTimeout(onFinish, HOLD_MS);
    }
    return () => clearTimeout(holdTimeout.current);
  }, [show, onFinish]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#f7f6f3] to-[#e2e0da] flex items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <img
              src="/logo-light-wordmark.svg"
              alt="UrbanFlow"
              className="w-64 sm:w-72 select-none"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
