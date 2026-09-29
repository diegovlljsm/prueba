import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { ChevronLeft, Car, Bike, Footprints, Bus, Navigation } from 'lucide-react';
import { cn } from '../lib/utils';
import { MAP_STYLES, MAP_STYLES_LIGHT } from '../constants';

type Mode = 'DRIVING' | 'BICYCLING' | 'WALKING' | 'TRANSIT';

// OpenRouteService (openrouteservice.org) - free, no credit card, powers
// real driving/cycling/walking routes over OpenStreetMap data. It has no
// public-transit profile, so that mode stays disabled rather than faking it.
const ORS_PROFILES: Partial<Record<Mode, string>> = {
  DRIVING: 'driving-car',
  BICYCLING: 'cycling-regular',
  WALKING: 'foot-walking',
};

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';

const MODES: { id: Mode; icon: React.ReactNode; supported: boolean }[] = [
  { id: 'DRIVING', icon: <Car className="w-5 h-5" />, supported: true },
  { id: 'BICYCLING', icon: <Bike className="w-5 h-5" />, supported: true },
  { id: 'WALKING', icon: <Footprints className="w-5 h-5" />, supported: true },
  { id: 'TRANSIT', icon: <Bus className="w-5 h-5" />, supported: false },
];

const getOriginIcon = (color: string) => {
  const svg = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" fill="${color}" fill-opacity="0.25"/><circle cx="11" cy="11" r="6" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// isLight swaps the inner disc from near-black to white - needed for the
// black/event route color, since a black star on the dark-theme disc would
// otherwise be invisible.
const getDestinationIcon = (color: string, isLight: boolean) => {
  const innerFill = isLight ? '#ffffff' : '#0a0f02';
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="${color}" fill-opacity="0.25"/><circle cx="20" cy="20" r="13" fill="${innerFill}" stroke="${color}" stroke-width="3"/><path d="M20 10.5l2.47 6.36 6.53.53-5 4.36 1.53 6.75L20 24.5l-5.53 3.5 1.53-6.75-5-4.36 6.53-.53z" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

interface RouteSummary {
  durationText: string;
  distanceText: string;
}

interface RouteEngineProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: Mode;
  onResult: (summary: RouteSummary | null, error: string | null) => void;
  isLight: boolean;
  destinationType: 'spot' | 'event';
}

// Fetches the route from OpenRouteService and draws it imperatively on the
// map (custom double-line glow effect) using the core Maps JS API - this
// library's installed version has no built-in <Polyline> component. Dark
// theme keeps its original thick neon-glow line regardless of destination
// type; light theme instead draws one thin flat line, colored green for a
// spot route or black for an event route (no glow layer - it read as too
// heavy against the light map).
const RouteEngine = ({ origin, destination, mode, onResult, isLight, destinationType }: RouteEngineProps) => {
  const map = useMap('route-map');
  const glowLineRef = useRef<google.maps.Polyline | null>(null);
  const mainLineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const profile = ORS_PROFILES[mode];
    if (!profile) return;

    const clearOverlays = () => {
      glowLineRef.current?.setMap(null);
      mainLineRef.current?.setMap(null);
      originMarkerRef.current?.setMap(null);
      destMarkerRef.current?.setMap(null);
    };

    if (!ORS_API_KEY) {
      clearOverlays();
      onResult(null, 'Falta configurar la clave de OpenRouteService (gratis, sin tarjeta) en VITE_ORS_API_KEY.');
      return;
    }

    let cancelled = false;

    fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`ORS request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        clearOverlays();

        const feature = data.features?.[0];
        const coords: [number, number][] = feature?.geometry?.coordinates;
        const summary = feature?.properties?.summary;
        if (!coords || !summary) {
          onResult(null, 'No se pudo calcular la ruta para este modo de viaje.');
          return;
        }

        const path = coords.map(([lng, lat]) => ({ lat, lng }));

        // Same color drives the line and both markers: green for a spot
        // route, black for an event route, only in light theme - dark
        // theme always stays neon green regardless of destination type.
        const accentColor = isLight ? (destinationType === 'event' ? '#1a1a1a' : '#96ab79') : '#a3ff12';

        if (isLight) {
          mainLineRef.current = new google.maps.Polyline({
            path, strokeColor: accentColor, strokeOpacity: 1, strokeWeight: 3, map, zIndex: 2,
          });
        } else {
          glowLineRef.current = new google.maps.Polyline({
            path, strokeColor: accentColor, strokeOpacity: 0.25, strokeWeight: 14, map, zIndex: 1,
          });
          mainLineRef.current = new google.maps.Polyline({
            path, strokeColor: accentColor, strokeOpacity: 1, strokeWeight: 5, map, zIndex: 2,
          });
        }
        originMarkerRef.current = new google.maps.Marker({
          position: path[0], map, icon: getOriginIcon(accentColor), zIndex: 3,
        });
        destMarkerRef.current = new google.maps.Marker({
          position: path[path.length - 1], map, icon: { url: getDestinationIcon(accentColor, isLight), anchor: new google.maps.Point(20, 20) }, zIndex: 3,
        });

        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, 60);

        onResult({ durationText: formatDuration(summary.duration), distanceText: formatDistance(summary.distance) }, null);
      })
      .catch((err) => {
        if (cancelled) return;
        clearOverlays();
        console.error('OpenRouteService error:', err);
        onResult(null, 'No se pudo calcular la ruta. Intenta de nuevo más tarde.');
      });

    return () => {
      cancelled = true;
      clearOverlays();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mode, origin.lat, origin.lng, destination.lat, destination.lng, isLight, destinationType]);

  return null;
};

interface RouteViewProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number; name: string; type?: 'spot' | 'event' };
  onClose: () => void;
  isLight?: boolean;
}

export const RouteView = ({ origin, destination, onClose, isLight = false }: RouteViewProps) => {
  const [mode, setMode] = useState<Mode>('DRIVING');
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleResult = (newSummary: RouteSummary | null, err: string | null) => {
    setSummary(newSummary);
    setError(err);
    setIsLoading(false);
  };

  const handleModeChange = (m: Mode, supported: boolean) => {
    if (m === mode || !supported) return;
    setIsLoading(true);
    setMode(m);
  };

  const startNavigation = () => {
    const travelmode = mode.toLowerCase();
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`,
      '_blank'
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[4000] bg-slate-950 flex flex-col light:bg-white"
    >
      {/* Top card: origin / destination + mode tabs */}
      <div className="bg-[#0a0f02] border-b border-white/5 pt-[calc(env(safe-area-inset-top)+12px)] px-4 pb-4 space-y-3 z-10 light:bg-white light:border-black">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="shrink-0 p-2.5 bg-white/5 rounded-full text-white active:scale-90 transition-transform light:bg-white light:border light:border-black light:text-black"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2 light:bg-white light:border-black">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#a3ff12] shrink-0 light:border-[#96ab79]" />
              <p className="text-sm text-slate-300 truncate light:text-slate-700">Tu ubicación</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#a3ff12] shrink-0 light:bg-[#96ab79]" />
              <p className="text-sm text-white font-semibold truncate light:text-black">{destination.name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id, m.supported)}
              disabled={!m.supported}
              title={m.supported ? undefined : 'No disponible por ahora'}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl border transition-all',
                !m.supported && 'opacity-30 cursor-not-allowed',
                mode === m.id
                  ? 'bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 light:bg-white light:border-black light:text-black'
              )}
            >
              {m.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          id="route-map"
          defaultCenter={origin}
          defaultZoom={14}
          styles={isLight ? MAP_STYLES_LIGHT : MAP_STYLES}
          className={cn("w-full h-full", isLight ? "google-map-light" : "google-map-dark")}
          disableDefaultUI={true}
          gestureHandling="greedy"
        >
          <RouteEngine origin={origin} destination={destination} mode={mode} onResult={handleResult} isLight={isLight} destinationType={destination.type ?? 'spot'} />
        </Map>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 pointer-events-none light:bg-white/60">
            <div className="w-8 h-8 border-4 border-[#a3ff12] border-t-transparent rounded-full animate-spin light:border-[#96ab79]" />
          </div>
        )}
      </div>

      {/* Bottom card */}
      <div className="bg-[#0a0f02] border-t border-white/5 p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] space-y-4 z-10 light:bg-white light:border-black">
        {error ? (
          <p className="text-sm text-rose-400 text-center py-2 light:text-rose-600">{error}</p>
        ) : summary ? (
          <div>
            <p className="text-2xl font-bold text-white light:text-black">
              {summary.durationText} <span className="text-base font-semibold text-slate-400 light:text-slate-600">({summary.distanceText})</span>
            </p>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mt-1 light:text-slate-600">La ruta más rápida</p>
          </div>
        ) : null}

        <button
          onClick={startNavigation}
          disabled={!summary}
          className="w-full bg-[#a3ff12] disabled:opacity-40 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all light:bg-[#96ab79] light:text-white"
        >
          <Navigation className="w-4 h-4" /> INICIAR NAVEGACIÓN
        </button>
      </div>
    </motion.div>
  );
};
