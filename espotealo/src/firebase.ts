import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import configDeArchivo from '../firebase-applet-config.json';

/**
 * Configuración de Firebase.
 *
 * Las variables de entorno mandan sobre el JSON. Ese fichero lo generó AI
 * Studio apuntando a su propio proyecto (`project-5edc560e-…`); para trabajar
 * contra otro proyecto basta con rellenar las VITE_FIREBASE_* en `.env.local`,
 * sin tocar código.
 *
 * Nada de esto es secreto: la configuración web de Firebase viaja en el bundle
 * del navegador por diseño. Lo que protege el proyecto son las reglas de
 * seguridad de Firestore y los dominios autorizados, no ocultar estos valores.
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

/**
 * Id de la base de Firestore. El proyecto de AI Studio usa una base con nombre
 * (`ai-studio-…`) en lugar de la `(default)`; un proyecto normal usa la por
 * defecto, y entonces esto debe quedar vacío.
 */
// `||` y no `??` a propósito: una variable declarada pero vacía en .env.local
// llega como cadena vacía, no como undefined, y con `??` se tomaría por buena.
// El cliente acabaría en la base (default) mientras el servidor sigue en la
// que dice el JSON — dos mitades leyendo datos distintos.
const firestoreDatabaseId =
  env.VITE_FIRESTORE_DATABASE_ID || configDeArchivo.firestoreDatabaseId || '';

if (import.meta.env.DEV) {
  console.info(
    `[firebase] proyecto: ${firebaseConfig.projectId}` +
      (firestoreDatabaseId ? ` · base: ${firestoreDatabaseId}` : ' · base: (default)')
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
