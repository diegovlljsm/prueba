import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { APIProvider } from '@vis.gl/react-google-maps';
import App from './App.tsx';
import './index.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <App />
    </APIProvider>
  </StrictMode>,
);
