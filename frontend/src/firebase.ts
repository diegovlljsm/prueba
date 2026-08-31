import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import configDeArchivo from '../firebase-applet-config.json';

/**
 * Configuración de Firebase.
 *
 * Las variables de entorno mandan sobre el JSON. Ese fichero lo generó AI
 * Studio apuntando a su propio proyecto; para trabajar contra otro proyecto
 * (o para tener uno distinto en local y en producción) basta con rellenar las
 * VITE_FIREBASE_* en .env.local, sin tocar código.
 *
 * Nada de esto es secreto: la configuración web de Firebase viaja en el bundle
 * del navegador por diseño. Lo que protege el proyecto son las reglas de
 * seguridad y los dominios autorizados, no ocultar estos valores.
 */
const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || configDeArchivo.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || configDeArchivo.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || configDeArchivo.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || configDeArchivo.storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || configDeArchivo.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || configDeArchivo.appId,
};

if (import.meta.env.DEV) {
  console.info(`[firebase] proyecto activo: ${firebaseConfig.projectId}`);
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore ya no se usa: los usuarios, sus roles y todo el contenido viven en
// PostgreSQL detrás de nuestra API (ver ADR-001). Se retiró de aquí a
// propósito, para que no queden dos sitios donde vive el mismo dato.
