import { useState, useEffect, useCallback } from 'react';
import { auth, googleProvider, db } from '../firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Traduce el código de error de Firebase a algo que una persona pueda leer y
 * accionar. Antes estos errores solo iban a console.error, así que al fallar
 * el login la pantalla no cambiaba y parecía que el botón no hacía nada.
 */
function mensajeDeError(codigo: string): string {
  switch (codigo) {
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado en el proyecto de Firebase. Hay que añadirlo en Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'El acceso con Google no está habilitado en el proyecto de Firebase. Hay que activarlo en Authentication → Sign-in method.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo cuando quieras.';
    case 'auth/network-request-failed':
      return 'No hay conexión con Google. Revisa tu red y vuelve a intentarlo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un momento antes de volver a probar.';
    default:
      return 'No pudimos completar el acceso con Google. Puedes entrar como invitado mientras lo revisamos.';
  }
}

/** Estos fallos son de la ventana emergente, no del acceso: se reintenta por redirección. */
const FALLOS_DE_POPUP = ['auth/popup-blocked', 'auth/cancelled-popup-request'];

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoadingAuth(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsGuest(false);

        // Check/Create user profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: 'user',
            createdAt: serverTimestamp()
          });
        } else {
          const userData = userSnap.data();
          if (userData.role === 'admin') {
            setIsAdmin(true);
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Cuando el acceso se hace por redirección, el usuario vuelve a la app con el
  // resultado colgando de la sesión. Si no se recoge aquí, un fallo en ese
  // camino se pierde en silencio y la persona ve la pantalla de login otra vez
  // sin ninguna explicación.
  useEffect(() => {
    getRedirectResult(auth).catch((error: unknown) => {
      const codigo = (error as { code?: string })?.code ?? '';
      if (!codigo) return;
      console.error('[auth] falló el acceso por redirección:', codigo, error);
      setAuthError(mensajeDeError(codigo));
    });
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const codigo = (error as { code?: string })?.code ?? '';

      // Si lo que falló fue la ventana emergente, el acceso todavía puede salir
      // adelante por redirección en la misma pestaña. Brave y Safari bloquean
      // estos popups por defecto, así que este camino no es excepcional.
      if (FALLOS_DE_POPUP.includes(codigo)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // La página navega fuera; no hay nada más que hacer aquí.
        } catch (errorRedireccion: unknown) {
          const codigoRedireccion = (errorRedireccion as { code?: string })?.code ?? '';
          console.error('[auth] la redirección también falló:', codigoRedireccion, errorRedireccion);
          setAuthError(mensajeDeError(codigoRedireccion || codigo));
          return;
        }
      }

      console.error('[auth] falló el acceso con Google:', codigo || error);

      if (codigo === 'auth/unauthorized-domain') {
        console.error(
          [
            '',
            'Cómo se arregla:',
            '  1. Abre https://console.firebase.google.com',
            '  2. Elige el proyecto y ve a Authentication → Settings → Authorized domains',
            `  3. Añade el dominio: ${window.location.hostname}`,
            '  4. Comprueba también que Google esté activado en Authentication → Sign-in method',
            '',
          ].join('\n')
        );
      }

      setAuthError(mensajeDeError(codigo));
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
      setAuthError(null);
    } catch (error) {
      console.error('[auth] falló el cierre de sesión:', error);
    }
  }, []);

  const handleContinueAsGuest = useCallback(() => {
    setAuthError(null);
    setIsGuest(true);
  }, []);

  const dismissAuthError = useCallback(() => setAuthError(null), []);

  const showAuthScreen = !user && !isGuest && !isLoadingAuth;

  return {
    user,
    isGuest,
    // isAdmin reflects the role stored in Firestore for this user - it is
    // set only inside onAuthStateChanged above, never toggled client-side.
    // The server independently re-checks this role on every admin request,
    // so this value should be treated as UI-only (e.g. showing/hiding the
    // admin tab), never as the actual authorization boundary.
    isAdmin,
    isLoadingAuth,
    isSigningIn,
    authError,
    dismissAuthError,
    showAuthScreen,
    handleGoogleSignIn,
    handleSignOut,
    handleContinueAsGuest,
    setIsGuest
  };
}
