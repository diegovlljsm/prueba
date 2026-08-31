import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Coordenada } from '../lib/geo';
import { limpiarInstruccion } from '../lib/geo';

export type ModoViaje = 'DRIVING' | 'BICYCLING' | 'WALKING' | 'TRANSIT';

export interface TramoRuta {
  /** "Dirígete al oeste por Main St" */
  instruccion: string;
  /** "450 m" */
  distancia: string;
  /** "2 min" */
  duracion: string;
  /** Maniobra de Google ("turn-left", "turn-right"…), si la trae. */
  maniobra?: string;
}

export interface ResumenRuta {
  distancia: string;
  duracion: string;
  tramos: TramoRuta[];
}

/**
 * Calcula y dibuja la ruta del usuario a un spot.
 *
 * La línea la pinta un DirectionsRenderer sobre el mapa; el resumen y los
 * tramos se devuelven para pintarlos en el panel de "Cómo llegar".
 *
 * Requiere que la **Directions API** esté habilitada en la clave de Google,
 * además de la Maps JavaScript API. Son dos servicios distintos: con la clave
 * del mapa sola, esto devuelve REQUEST_DENIED.
 */
export function useRuta() {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');

  const [modo, setModo] = useState<ModoViaje>('DRIVING');
  const [destino, setDestino] = useState<Coordenada | null>(null);
  const [origen, setOrigen] = useState<Coordenada | null>(null);
  const [resumen, setResumen] = useState<ResumenRuta | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servicio = useMemo(
    () => (routesLib ? new routesLib.DirectionsService() : null),
    [routesLib]
  );

  const renderer = useRef<google.maps.DirectionsRenderer | null>(null);

  // El renderer se crea una vez y se reutiliza. Crear uno por cálculo deja
  // líneas huérfanas dibujadas encima del mapa.
  useEffect(() => {
    if (!routesLib || !map) return;

    renderer.current = new routesLib.DirectionsRenderer({
      map,
      // Los marcadores por defecto de Google (globos rojos con letras) rompen
      // la identidad del mapa; el spot ya tiene su propio marcador.
      suppressMarkers: true,
      suppressInfoWindows: true,
      polylineOptions: {
        strokeColor: '#baf413',
        strokeOpacity: 0.95,
        strokeWeight: 5,
      },
    });

    return () => {
      renderer.current?.setMap(null);
      renderer.current = null;
    };
  }, [routesLib, map]);

  const limpiar = useCallback(() => {
    setDestino(null);
    setOrigen(null);
    setResumen(null);
    setError(null);
    // setDirections(null) no está tipado en todas las versiones, pero es la
    // forma soportada de borrar la ruta dibujada.
    renderer.current?.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
  }, []);

  const calcular = useCallback(
    (desde: Coordenada, hasta: Coordenada, modoViaje: ModoViaje = modo) => {
      setOrigen(desde);
      setDestino(hasta);
      setModo(modoViaje);
    },
    [modo]
  );

  useEffect(() => {
    if (!servicio || !origen || !destino) return;

    let cancelado = false;
    setCalculando(true);
    setError(null);

    servicio
      .route({
        origin: origen,
        destination: destino,
        travelMode: modo as google.maps.TravelMode,
        provideRouteAlternatives: false,
      })
      .then((resultado) => {
        if (cancelado) return;

        renderer.current?.setDirections(resultado);

        const tramo = resultado.routes[0]?.legs[0];
        if (!tramo) {
          setError('No encontramos una ruta hasta este spot.');
          setResumen(null);
          return;
        }

        setResumen({
          distancia: tramo.distance?.text ?? '',
          duracion: tramo.duration?.text ?? '',
          tramos: (tramo.steps ?? []).map((paso) => ({
            instruccion: limpiarInstruccion(paso.instructions ?? ''),
            distancia: paso.distance?.text ?? '',
            duracion: paso.duration?.text ?? '',
            maniobra: (paso as { maneuver?: string }).maneuver,
          })),
        });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        const estado = (err as { code?: string })?.code ?? '';
        console.error('[ruta] falló el cálculo:', estado || err);

        // Estos dos son de configuración, no del usuario: merecen un mensaje
        // que diga qué hay que arreglar en la consola de Google.
        if (estado === 'REQUEST_DENIED') {
          setError(
            'La Directions API no está habilitada en la clave de Google. Hay que activarla en Google Cloud, aparte de la Maps JavaScript API.'
          );
        } else if (estado === 'OVER_QUERY_LIMIT') {
          setError('Se agotó la cuota de la Directions API por hoy.');
        } else if (estado === 'ZERO_RESULTS') {
          setError('No hay ruta posible hasta este spot en el modo elegido.');
        } else {
          setError('No pudimos calcular la ruta. Inténtalo de nuevo.');
        }
        setResumen(null);
      })
      .finally(() => {
        if (!cancelado) setCalculando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [servicio, origen, destino, modo]);

  return {
    modo,
    setModo,
    destino,
    resumen,
    calculando,
    error,
    /** ¿Está la librería de rutas cargada y lista? */
    disponible: Boolean(servicio),
    calcular,
    limpiar,
  };
}
