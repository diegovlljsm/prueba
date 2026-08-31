import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { APIProvider } from '@vis.gl/react-google-maps';
import App from './App.tsx';
import { NotFound } from './components/NotFound';
import './index.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// La aplicación es de una sola pantalla y no usa enrutador: toda la navegación
// es estado interno. Cualquier ruta distinta de la raíz es, por definición, una
// dirección que no existe. El servidor devuelve index.html para todo (SPA
// fallback), así que sin esta comprobación un enlace roto mostraría el mapa
// como si nada hubiera pasado.
const esRaiz = window.location.pathname === '/' || window.location.pathname === '/index.html';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {esRaiz ? (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <App />
      </APIProvider>
    ) : (
      <NotFound />
    )}
  </StrictMode>,
);
