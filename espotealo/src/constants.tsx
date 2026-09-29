import React from 'react';
import { Activity, Bike, Navigation, Layers } from 'lucide-react';
import { Category } from './types';
import { CATEGORY_IDS } from './constants.shared';

export const CATEGORIES: Category[] = [
  { id: CATEGORY_IDS[0], name: 'Skateboarding', icon: <Activity className="w-4 h-4" /> },
  { id: CATEGORY_IDS[1], name: 'BMX', icon: <Bike className="w-4 h-4" /> },
  { id: CATEGORY_IDS[2], name: 'Parkour', icon: <Navigation className="w-4 h-4" /> },
  { id: CATEGORY_IDS[3], name: 'Otro', icon: <Layers className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------
// MOCK DATA - "Spots" feed ("Activos ahora" live-presence and the "Top de
// la semana" editorial pick). There's no real-time presence system (who's
// physically at a spot right now) and no editorial-pick backend yet, so
// these stay hardcoded. Everything else the feed shows (spot counts per
// category, distance, rating, "sin foto" list, "nuevos esta semana", the
// featured spot's nearby event) is computed live from real spots/events
// data - see the "Spots" tab in MobileLayout.tsx.
// ---------------------------------------------------------------------
export const MOCK_ACTIVE_NOW: { spotId: string; riderCount: number }[] = [
  { spotId: 'spot-4', riderCount: 9 },
  { spotId: 'spot-6', riderCount: 4 },
];
export const MOCK_NEARBY_RIDER_BADGE: Record<string, number> = { 'spot-1': 8 };
export const MOCK_FEATURED_SPOT_ID = 'spot-2';
export const MOCK_FEATURED_UPLOADER = '@kev.skt';

// "Nuevos spots" carousel in the Spots tab, right before "Explorar por
// país" - surfaces the 4 regional spots that just got real photos
// (Sausalito, Quintero, Rancagua/Mekis, San Alberto) instead of leaving
// them buried inside the collapsed Chile folder.
export const NEW_SPOTS_CAROUSEL_IDS = ['spot-16', 'spot-17', 'spot-18', 'spot-29'];

// Country folders for the "Explorar por país" section - all real spots
// today are in Chile, so that folder shows a real count and expands to the
// real grid. The rest are placeholder folders (honestly "Próximamente",
// not a fabricated count) marking where future regions will slot in once
// spots from those countries get added.
export const FUTURE_COUNTRY_FOLDERS = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
];

// Centro de ayuda FAQ - respuestas basadas en el comportamiento real de la
// app (revisión de clips, modo invitado, cálculo de distancia en línea
// recta), no inventadas. Ver Configuración > Centro de ayuda.
export const HELP_FAQS = [
  {
    id: 'faq-1',
    question: '¿Cómo subo un spot?',
    answer: 'Toca el botón + del centro de la barra inferior, ubica el pin en la entrada del spot y añade al menos una foto del suelo. Se publica al instante y un moderador lo verifica en unas horas.',
  },
  {
    id: 'faq-2',
    question: '¿Por qué mi spot está «en revisión»?',
    answer: 'Los spots se publican al instante, pero los clips que subes a un spot pasan por revisión de un moderador antes de aparecer en el feed público - normalmente toma unas horas.',
  },
  {
    id: 'faq-3',
    question: '¿Puedo usar la app sin cuenta?',
    answer: 'Sí. En modo invitado puedes explorar el mapa y ver spots y eventos. Para subir spots, dejar reseñas o apuntarte a eventos necesitas iniciar sesión con Google.',
  },
  {
    id: 'faq-4',
    question: '¿Cómo se calcula la distancia?',
    answer: 'Es la distancia en línea recta desde tu ubicación actual hasta el spot. Al trazar una ruta hacia un spot, ahí sí se calcula la distancia real caminando, en bici o en auto.',
  },
  {
    id: 'faq-5',
    question: 'Un spot ya no existe o es peligroso',
    answer: 'Usa «Reportar un problema» más abajo o escríbenos directamente. Un administrador puede revisar y borrar el spot desde el panel de moderación.',
  },
];

export const MAP_STYLES = [
  { "featureType": "all", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
  { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#64748b" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#334155" }] },
  { "featureType": "road.highway", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] },
  // Sin nombres de ciudad, comuna ni barrio: en el mapa oscuro compiten con
  // los pines de spots, que son lo que el usuario viene a mirar.
  { "featureType": "administrative.locality", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "administrative.neighborhood", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "visibility": "on" }, { "color": "#064e3b" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#cbd5e1" }] },
  // Transporte completamente apagado: las estaciones de metro se dibujan como
  // marcadores propios (METRO_STATIONS + METRO_ICON en los layouts), porque
  // Google no permite reemplazar ni colorear con exactitud sus iconos.
  { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
];

// Light theme ("Tema Claro") map skin - a real Google Maps light style,
// modeled on a minimal EV-dashboard look: near-white/cool-gray base, roads
// as faint white lines with barely-there strokes, and every label pushed
// way down in contrast so streets/avenues/localities read as background
// texture rather than competing with the app's own UI.
export const MAP_STYLES_LIGHT = [
  { "featureType": "all", "elementType": "geometry", "stylers": [{ "color": "#f2f2f2" }] },
  { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
  { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#c2c2c2" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#e6e6e6" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#bcbcbc" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#ededed" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#dcdcdc" }] },
  { "featureType": "road.highway", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e6e6e6" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#a3a3a3" }] },
  { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "visibility": "on" }, { "color": "#ececea" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#bcbcbc" }] },
  { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
];

// Avatares predefinidos que el usuario puede elegir en Editar perfil, en
// vez de (o además de) subir su propia foto - ver EditProfileForm.tsx.
// La selección se guarda de verdad en UserProfile.photoURL (PUT
// /api/users/me), no es una maqueta.
export const AVATAR_OPTIONS = [
  '/avatars/avatar-1.png',
  '/avatars/avatar-2.png',
  '/avatars/avatar-3.png',
  '/avatars/avatar-4.png',
  '/avatars/avatar-5.png',
  '/avatars/avatar-6.png',
];

// Banners de portada predefinidos para el encabezado del perfil, en vez de
// (o además de) subir uno propio - ver EditProfileForm.tsx y
// UserProfile.bannerURL.
export const BANNER_OPTIONS = [
  '/banners/banner-skate-1.jpg',
  '/banners/banner-skate-2.jpg',
  '/banners/banner-bmx-1.jpg',
  '/banners/banner-bmx-2.jpg',
  '/banners/banner-roller-1.jpg',
  '/banners/banner-roller-2.jpg',
];
