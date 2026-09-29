import React, { useState, useRef, useEffect } from 'react';
import { Map, Marker } from '@vis.gl/react-google-maps';
import {
  MapPin, Plus, ShieldCheck, X, ChevronLeft, Search, Filter, Locate,
  Map as MapIcon, List as ListIcon, Users, User, Bell, Calendar, Trophy,
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, LogOut, LogIn, ChevronRight, Star,
  Mountain, TriangleAlert, Soup, Atom, ArrowUpRight, Camera,
  Settings as SettingsIcon, Ruler, Shield, HelpCircle, Sparkles,
  Mail, Download, Moon, Minus, Instagram as InstagramIcon, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, PLACEHOLDER_IMAGE, handleImageError, getDistanceKm, toDate, getOpenState, eventCategoryLabel, getRelatedSpots, getNearbyEvents, getNearbySpots } from '../lib/utils';
import { Spot, UrbanEvent, VideoClip, SpotPhoto, SpotReview, EventPhoto, EventReview, FirebaseUser, UserProfile, ChallengesResponse, CommunityPost, PostComment, ActivityItem, AppNotification, PublicProfile, SPOT_FEATURES } from '../types';
import {
  CATEGORIES, MAP_STYLES, MAP_STYLES_LIGHT,
  BANNER_OPTIONS,
  MOCK_ACTIVE_NOW, MOCK_NEARBY_RIDER_BADGE, MOCK_FEATURED_SPOT_ID, MOCK_FEATURED_UPLOADER,
  FUTURE_COUNTRY_FOLDERS, NEW_SPOTS_CAROUSEL_IDS, HELP_FAQS,
} from '../constants';
import { PostCard, PostComposer, PostDetail, StoriesRow, PublicProfileView } from '../components/Community';
import { ActivityList, MySpotsList, NotificationsScreen } from '../components/ActivityFeed';
import { METRO_STATIONS } from '../data/metroStations';
import { Wordmark } from '../components/Wordmark';
import { SpotDetail } from '../components/SpotDetail';
import { EventDetail } from '../components/EventDetail';
import { AddSpotForm } from '../components/AddSpotForm';
import { EditProfileForm } from '../components/EditProfileForm';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MARKER_GREEN = '#a3ff12';
const MARKER_ORANGE = '#ff7a1a';

// Pins scale down as the map zooms out (mapZoom comes from App.tsx's
// zoom_changed listener), so a national/regional view with lots of spots
// doesn't turn into a wall of overlapping full-size pins. Full size at
// "close" zoom (16, same level the app snaps to when opening a spot),
// shrinking to 40% at "country-wide" zoom (5).
const MIN_PIN_SCALE = 0.4;
const ZOOM_FOR_MIN_SCALE = 5;
const ZOOM_FOR_MAX_SCALE = 16;

const getPinScale = (zoom: number) => {
  const t = (zoom - ZOOM_FOR_MIN_SCALE) / (ZOOM_FOR_MAX_SCALE - ZOOM_FOR_MIN_SCALE);
  return MIN_PIN_SCALE + Math.max(0, Math.min(1, t)) * (1 - MIN_PIN_SCALE);
};

const getMarkerIcon = (color: string, glow: boolean = false, zoom: number = ZOOM_FOR_MAX_SCALE) => {
  const scale = getPinScale(zoom);
  const width = (26 * scale).toFixed(1);
  const height = (35 * scale).toFixed(1);
  const glowDefs = glow
    ? '<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    : '';
  const pinAttrs = glow ? ' filter="url(#glow)"' : '';
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 111.96 142.62" fill="none" xmlns="http://www.w3.org/2000/svg">${glowDefs}<ellipse cx="55.98" cy="135" rx="19" ry="5.5" fill="black" fill-opacity="0.35"/><path d="M61.2,139.96c-1.58,1.73-3.09,2.6-5.06,2.65-2.09.06-3.75-.89-5.27-2.54-11.8-12.87-22.83-26.21-32.63-40.72C10.91,88.5,1.05,71.69.13,59.01c-1.07-14.74,4.27-29.09,13.81-39.93,22.31-25.36,61.48-25.45,83.91-.18,9.7,10.93,15.12,25.5,13.95,40.4-1.03,13.1-11.57,30.53-19.21,41.7-9.46,13.83-20.04,26.52-31.39,38.97ZM79.9,52.45c0-13.21-10.71-23.92-23.92-23.92s-23.92,10.71-23.92,23.92,10.71,23.92,23.92,23.92,23.92-10.71,23.92-23.92Z" fill="${color}"${pinAttrs}/><circle cx="55.98" cy="52.45" r="23.92" fill="#eef1e9"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Light theme events reuse the pin shape/icon of dark mode (getMarkerIcon
// above) with a desaturated terracotta - paired with the green instead of
// the dark theme's fully-saturated orange, which read too loud against the
// light map. Spots in light theme use their own illustrated pin below.
const LIGHT_ACCENT = '#96ab79';
const LIGHT_EVENT_COLOR = '#d97e3f';

// Etiquetas cortas para la tarjeta compacta del mapa: ahí "Skateboarding" no
// cabe junto a las demás, pero en el resto de la app se sigue usando el nombre
// completo de CATEGORIES.
const SHORT_CATEGORY_LABELS: Record<string, string> = {
  skate: 'Skate',
  bmx: 'BMX',
  parkour: 'Parkour',
  other: 'Otro',
};

// `category` llega en dos formatos: los spots del catastro lo guardan como
// texto plano ("skate") y los que sube un usuario como JSON ('["bmx","skate"]',
// ver AddSpotForm). Hay que aceptar ambos o las tarjetas de casi todo el
// catastro se quedan sin disciplinas.
const spotCategoryLabels = (category?: string): string[] => {
  if (!category) return [];
  let ids: string[];
  try {
    const parsed = JSON.parse(category);
    ids = Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    ids = category.split(',').map(c => c.trim()).filter(Boolean);
  }
  return ids.map(id => SHORT_CATEGORY_LABELS[id] ?? id);
};

// Pin ilustrado del skater para los spots, con paleta por tema (SVGs de marca
// del usuario: "Recurso 17" y "18" para el tema claro, "Recurso 19" para el
// oscuro). Va aparte de getMarkerIcon porque no es el mismo dibujo recoloreado.
//
// Tema claro: normal = pin sólido con la figura en blanco; seleccionado =
// disco blanco con anillo lima y la figura verde. Tema oscuro: sólo existe la
// variante con disco, así que ambos estados la usan y el seleccionado sólo
// crece.
//
// El anillo se engrosa respecto al original (1.89) porque a tamaño de marcador
// el trazo fino desaparecía, y los filtros de los SVG originales (sombra en
// claro, resplandor en oscuro) se sustituyen por la elipse que ya usaba el pin
// genérico: se salen del viewBox y Google Maps no los renderiza de forma
// fiable dentro de un data URI.
// Icono de estación de metro (SVG de marca del usuario, "Recurso 20"). Se
// dibuja sólo en el tema oscuro y sólo desde MIN_ZOOM_FOR_METRO: son 126
// estaciones, y a nivel región llenarían el mapa tapando los spots, que es lo
// que el usuario viene a mirar. El data URI se calcula una vez y se reutiliza
// en los 126 marcadores en vez de regenerarlo por marcador.
// Mismo gris que las etiquetas de calle del mapa oscuro (ver MAP_STYLES):
// las estaciones son referencia para ubicarse, no algo que haya que tocar,
// así que pesan igual que la tipografía del mapa y no como un pin.
const METRO_COLOR = '#94a3b8';
const MIN_ZOOM_FOR_METRO = 13;
// El icono crece con el zoom: a 13 tiene que leerse como textura de fondo
// (son decenas en pantalla en el centro de Santiago) y sólo al acercarse
// alcanza su tamaño pleno. A tamaño fijo competía con los pines de spots.
const METRO_MIN_HEIGHT = 10;
const METRO_MAX_HEIGHT = 20;
const ZOOM_FOR_MAX_METRO = 17;
const getMetroIcon = (zoom: number = ZOOM_FOR_MAX_METRO) => {
  const t = (zoom - MIN_ZOOM_FOR_METRO) / (ZOOM_FOR_MAX_METRO - MIN_ZOOM_FOR_METRO);
  const height = +(METRO_MIN_HEIGHT + Math.max(0, Math.min(1, t)) * (METRO_MAX_HEIGHT - METRO_MIN_HEIGHT)).toFixed(1);
  const width = +(height * 195.39 / 241.61).toFixed(1);
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 195.39 241.61" xmlns="http://www.w3.org/2000/svg"><path d="M186.65,161.97c0,11-8.34,19.42-19.13,19.42H27.97c-10.76,0-19.1-8.5-19.1-19.21V47.56C8.88,20.97,30.44,0,56.92,0h81.66c26.46,0,48.04,20.97,48.04,47.56l.02,114.4ZM87.77,49.15h-54.13v52.29h54.13v-52.29ZM107.73,49.15v52.29h54.14v-52.29h-54.14ZM58.96,142.61c0-6.99-5.67-12.66-12.66-12.66s-12.66,5.67-12.66,12.66,5.67,12.66,12.66,12.66,12.66-5.67,12.66-12.66ZM161.88,142.6c0-7-5.67-12.67-12.66-12.67s-12.66,5.67-12.66,12.67,5.67,12.67,12.66,12.67,12.66-5.67,12.66-12.67Z" fill="${METRO_COLOR}"/><polygon points="195.39 241.46 171.69 241.61 159.25 225.45 36.25 225.45 23.82 241.6 0 241.57 35.05 195.7 58.89 195.67 49.58 208.14 145.9 208.09 136.6 195.67 160.47 195.69 195.39 241.46" fill="${METRO_COLOR}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const SELECTED_PIN_GROWTH = 1.35;
// Pin de evento en tema oscuro (SVG de marca del usuario, "Recurso 21"): un
// badge hexagonal terracota con borde crema, deliberadamente distinto a la
// gota de los spots para que ambos tipos se distingan de lejos. El tema claro
// sigue usando getMarkerIcon con LIGHT_EVENT_COLOR. Como en los demás pines,
// el filtro de sombra del archivo original se omite: se sale del viewBox y
// Google Maps no lo dibuja de forma fiable dentro de un data URI.
const EVENT_PIN_FILL = '#ff6b2c';
const EVENT_PIN_EDGE = '#ffe7c0';
const EVENT_PIN_FIGURE = '#eef1e9';
const EVENT_HEX = 'M364.1,303.76v-144.85c0-9.57-5.1-18.41-13.39-23.19l-125.44-72.42c-8.29-4.78-18.49-4.78-26.78,0l-125.44,72.42c-8.29,4.78-13.39,13.62-13.39,23.19v144.85c0,9.57,5.1,18.41,13.39,23.19l125.44,72.42c8.29,4.78,18.49,4.78,26.78,0l125.44-72.42c8.29-4.78,13.39-13.62,13.39-23.19Z';
const EVENT_FIGURE = ['M203.1,339.97c-1.58,2.27-3.81,2.76-5.94,1.56l-11.54-6.49c-2.21-1.24-3.29-3.99-1.73-6.32l7.46-11.16c1.51-2.26,3.93-1.71,5.83-1.23l8.8-12.67-1.21-3.54c1.21-3.98,3.4-7.32,5.7-10.86l4.1-.57,6.81-21.97c1.3-4.19-1.69-9.08,1.25-13.68l11.96,3.66c1.77-.97,3.01-2.11,4.12-3.93-9.47-1.13-16.87-5.97-21.16-14.12-5-9.48-13.13-16.17-23.37-19.32-21.32-6.57-48.43-3.21-71.07.31-3.63.56-9.22-2.22-8.54-6.32,2.09-12.68,6.32-24.21,12.13-35.49,12.77-24.84,35.69-42.06,63.36-47.64,37.31-7.51,84.58,4.81,105.59,37.89,18.95,29.84,12.74,69.28-4.53,99.15-1.39,2.4-4.24,3.44-6.51,3.48-2.47.04-4.74-1.54-6.07-3.89l-4.88-8.62c-3.57-6.3-11.44-7.67-18.58-6.64l-11.92,1.71-3.05,11.7c-.27,1.05-1.83,1.7-2.21,2.3l-6.22,16.02,35.37-23.66c3.45,4.22,5.36,8.52,7.85,12.86-2.11,3.18-5.55,3.62-8.54,5.41l-37.89,22.64c-1.76,4.26-5.58,10.49-6.99,10.87-1.21.33-2.21.22-3.79-.71l-8.37,13.37c.72,2.04,1.76,4.44.03,6.93l-6.23,8.98ZM194.87,151.68c-1.68-4.9-13.4-4.74-19.25,1.54-1.36,1.46-1.52,3.72-.93,5.07.64,1.46,2.4,2.51,4.39,2.81,7.36,1.1,17.76-3.69,15.8-9.42ZM246.11,158.86c.27-1.74-.35-3.46-1.83-4.7-7.13-5.97-17.88-5.38-19.07-.98-.49,1.81-.08,3.91,1.51,5.25,7.06,5.96,18.58,5.73,19.39.43ZM281.07,180.55c3.31-3.87-2.02-12.44-10.18-14.7-1.89-.52-3.6,0-4.45.93-1.18,1.29-1.56,3.44-.75,5.21,3.08,6.7,11.89,12.63,15.38,8.56ZM132.05,186.74c-2.9-.84-4.98-1.01-6.83.65,2.31.64,5.25.99,6.83-.65ZM200.87,331.24c1.52.4,3.75-2.81,2.66-3.53l-7.54-4.95c-1.27,1.29-1.9,2.52-2.28,4.3,2.15,1.52,4.18,3.4,7.16,4.18Z', 'M177.81,295.17c3.5,7.07,7.51,13.37,13.12,19.31l-7.7,9.86c-8.11-6.61-13.08-15.14-17.21-24.34-1.26.4-3.73.75-4.34-.14-2.25-3.26-4.03-7.07-4.56-10.94-.21-1.54,1.75-2.88,3.17-3.62-4.46-11.86-8.29-23.75-11.59-36.2l-.42-5c-9.83-2.39-13.42-9.75-15.8-19.58,20.09-2.66,42.21-4.75,60.61,1.05,9.48,2.99,16.69,9.84,20.25,19.15-8.96-3.17-17.4-4.46-26.68-4.13-8.79.31-17.06,3.61-25.76,5.17l5.75,19.82,11.23-23.16,14.24-.75c-6.81,13.19-13.68,25.5-19.69,39.21.97.57,2.16.58,3.48.89l4.11,10.32c.39.98-.53,2.28-2.21,3.08Z'];

const getEventPinIcon = (zoom: number = ZOOM_FOR_MAX_SCALE, selected: boolean = false) => {
  const scale = getPinScale(zoom) * (selected ? SELECTED_PIN_GROWTH : 1);
  const height = (35 * scale).toFixed(1);
  const width = (32.1 * scale).toFixed(1);
  const figure = EVENT_FIGURE
    .map(d => `<path d="${d}" fill="${EVENT_PIN_FIGURE}" stroke="#413029" stroke-width="0.83"/>`)
    .join('');
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 423.84 462.72" xmlns="http://www.w3.org/2000/svg"><polygon points="364.1 319.22 364.1 143.45 211.88 55.57 59.66 143.45 59.66 319.22 211.88 407.11 364.1 319.22" fill="${EVENT_PIN_FILL}"/><path d="${EVENT_HEX}" fill="none" stroke="${EVENT_PIN_EDGE}" stroke-width="17"/>${figure}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const SPOT_PIN_THEMES = {
  light: { pin: '#96ab79', disc: '#ffffff', ring: '#c1ff3e', onDisc: '#96ab79', onSolid: '#ffffff' },
  dark: { pin: '#cdff1a', disc: '#f2ffc9', ring: '#cdff1a', onDisc: '#3d5600', onSolid: '#3d5600' },
} as const;
const PIN_SHAPE = 'M301.25,160.78c-1.25,19.14-5.12,37.11-11.75,55.15-19.33,52.54-58.15,99.95-102.02,134.16-10.05,7.82-20.07,14.4-31.34,20.67-2.95,1.64-6.12,2.32-8.96.83-10.69-5.69-20.4-11.92-30.17-19.33-45.25-34.35-85.49-83.15-105.12-136.88C5.36,197.51,1.54,179.73.31,160.78c-2.89-45.29,14.42-88.59,46.78-119.37,57.91-55.06,148.94-55.26,207.02-.34,32.57,30.78,50.07,74.23,47.14,119.71Z';
// Figura dentro del disco blanco (Recurso 17) - estado seleccionado.
const SKATER_INSET = ['M61.69,201.94c-13.33-5.57-24.31-17.73-16.93-29.4,2.31-3.65,5.58-5.39,9.38-7.67l120.16-71.99,15.18-8.93c6.04-3.55,11.9-7.46,18.62-9.6,7.35-2.34,14.71-2.72,22.03-.42,8.34,2.62,14.01,9.53,14.69,18.57.99,13.12-5.04,26.07-15.68,33.96l-69.96,40.68-52.7,31.85c-13.78,8.33-29.82,9.2-44.81,2.94ZM200.82,106.19c-.22-2.17-2.85-2.73-4.12-2.8-1.76-.1-3.87.78-3.92,2.94-.05,2.37,2.77,3.2,4.51,2.99,1.24-.15,3.73-1.17,3.53-3.13ZM209.86,112.31c.05-2.4-2.36-3.14-3.92-3.02-1.49.11-3.53,1.28-3.19,3.3.32,1.85,2.45,2.41,3.82,2.37,1.19-.03,3.25-.58,3.29-2.64ZM185.32,114.09c-.45-1.89-2.62-2.32-4.01-2.06-1.06.2-3.07,1.13-3.04,2.78.04,2.1,2.45,2.84,4.23,2.68,1.27-.11,3.27-1.49,2.81-3.4ZM195.6,121.62c-.46-1.41-1.7-2.2-3.12-2.17-1.3.02-2.62.77-3.06,2.16.78,1.34,1.87,1.9,3.05,1.87,1.17-.03,2.26-.54,3.13-1.86ZM106.82,159.64c-.55-1.91-3.07-1.87-4.32-1.58-.94.22-2.8.92-2.65,2.48.19,1.98,2.38,2.49,3.8,2.41s3.84-.97,3.17-3.32ZM116.64,166.75c.26-2.59-2.95-3.2-4.22-2.88-1.38.35-3.57,1.85-2.55,3.76s6.51,1.69,6.77-.88ZM92.29,170.3c.1-1.9-2.19-3.1-3.55-3.24-1.86-.18-4.06.66-4.29,2.81-.23,2.15,2.13,3.36,3.72,3.55,1.8.22,4-.99,4.12-3.12ZM101.29,176.43c-.12-2.22-2.89-3.01-4.31-2.69-1.29.29-3.33,1.31-3.2,3.04.14,1.86,2.31,2.62,3.61,2.65,1.49.03,4.03-.63,3.9-3.01Z', 'M214.04,174.33c-7.09-6.73-6.73-17.11-2.03-24.77,3.43-5.59,8.6-7.96,15.54-8.78-2.55-.87-4.83-.14-7.13-1.98l11.36-6.54c.83,4.07-1.37,6.97-4.85,9.51,11.33-.21,19.17,6.61,19.65,17.48.48,10.79-7.21,20.64-18.57,20.64-4.8,0-10.33-2.1-13.98-5.56ZM230.03,154.06c-1.27-.45-2.75-.02-4.04.97-2.33,1.8-3.05,4.42-2.83,7.31.15,1.96,1.13,4.98,3.81,5.61,2.66.63,4.7-1.81,5.69-3.4,2.26-3.62.9-9.24-2.63-10.5Z', 'M204.83,165.04c-5.66,1.58-10.27-.07-14.9-3.07-1.46,1.54-3.03,2.85-4.6,2.81-2.12-.04-4.2-.85-5.68-3.02l30.78-17.5c-.23,2.16-1.45,3.69-2.6,5.27-3.28,4.48-4.4,9.64-2.99,15.5Z', 'M139.23,212.54c2.74,6.92,2.08,13.8-1.92,20.23-6.32,10.17-18.41,12.11-29.43,4.83-10.53-6.95-11.81-23.61-1.51-31.49l26.11-16.65c2.74,3.14-1.53,8.38-5.98,12.46,5.85,1.28,10.41,4.74,12.74,10.62ZM126.31,200.73c-.01-1.16-.75-1.98-1.41-1.83-.96.22-1.7.54-2.63,1.62l4.04.22ZM123.81,207.91c2.3-.83,4.64-1.01,6.74-3.1-2.65-1.41-5.11-.22-7.51.91-4.42,2.08-8.89,4.01-11.66,8.61,4.5,2.91,5.71-3.99,12.42-6.42ZM121.11,229.23c3.34-.51,5.36-3.67,5.91-5.84.78-3.1.05-6.17-2.16-8.16-1.47-1.32-3.43-1.47-5.27-.73-3.06,1.24-5.98,6.58-4.05,11.06.73,1.7,2.78,4.09,5.56,3.66Z', 'M94.82,224.22c-8.82,1.48-19.33-3.87-20.05-12.81,8.02,1.02,14.86.58,22.45-1.89-2.11,4.99-3.17,8.73-2.4,14.69Z'];
// Figura sobre el pin lleno (Recurso 18) - estado normal. Ocupa todo el pin,
// por eso sus coordenadas no coinciden con las de SKATER_INSET.
const SKATER_SOLID = ['M58.47,203.68c-13.85-5.78-25.25-18.42-17.59-30.54,2.4-3.79,5.79-5.6,9.75-7.97l124.83-74.79,15.77-9.27c6.28-3.69,12.36-7.75,19.35-9.97,7.63-2.43,15.29-2.83,22.89-.44,8.66,2.72,14.55,9.9,15.26,19.29,1.03,13.63-5.23,27.09-16.29,35.28l-72.68,42.26-54.75,33.09c-14.31,8.65-30.98,9.56-46.55,3.06ZM203.01,104.2c-.23-2.25-2.96-2.83-4.28-2.91-1.83-.11-4.02.81-4.07,3.06-.05,2.46,2.87,3.33,4.68,3.11,1.29-.16,3.87-1.22,3.67-3.26ZM212.4,110.57c.05-2.5-2.46-3.26-4.07-3.14-1.55.12-3.67,1.33-3.31,3.43.33,1.92,2.54,2.5,3.96,2.46,1.23-.04,3.37-.6,3.42-2.75ZM186.91,112.41c-.47-1.97-2.72-2.41-4.16-2.14-1.11.21-3.19,1.17-3.16,2.89.04,2.18,2.55,2.95,4.4,2.78,1.32-.12,3.4-1.55,2.92-3.54ZM197.59,120.24c-.48-1.46-1.77-2.28-3.24-2.26-1.35.03-2.72.81-3.18,2.24.81,1.39,1.94,1.97,3.17,1.94,1.21-.03,2.35-.56,3.26-1.93ZM105.36,159.74c-.57-1.99-3.19-1.94-4.49-1.64-.97.23-2.91.95-2.75,2.58.2,2.05,2.47,2.59,3.95,2.51s3.99-1.01,3.29-3.45ZM115.56,167.12c.27-2.69-3.06-3.33-4.38-2.99-1.44.36-3.71,1.92-2.65,3.91s6.76,1.76,7.03-.92ZM90.26,170.81c.11-1.98-2.28-3.23-3.68-3.36-1.93-.19-4.22.68-4.46,2.92-.24,2.24,2.21,3.49,3.86,3.69,1.87.23,4.16-1.02,4.28-3.24ZM99.61,177.18c-.13-2.3-3-3.13-4.48-2.79-1.34.3-3.46,1.36-3.32,3.16.14,1.93,2.4,2.73,3.75,2.76,1.55.04,4.19-.65,4.05-3.12Z', 'M216.74,174.99c-7.37-6.99-6.99-17.78-2.1-25.74,3.57-5.81,8.94-8.27,16.14-9.12-2.65-.91-5.02-.14-7.41-2.06l11.8-6.79c.86,4.23-1.42,7.24-5.04,9.88,11.77-.22,19.91,6.87,20.42,18.16.5,11.21-7.49,21.44-19.29,21.44-4.98,0-10.73-2.18-14.52-5.78ZM233.35,153.93c-1.32-.47-2.85-.02-4.19,1.01-2.42,1.87-3.16,4.59-2.94,7.59.15,2.03,1.17,5.17,3.95,5.83,2.76.65,4.88-1.88,5.91-3.53,2.35-3.76.93-9.6-2.74-10.9Z', 'M207.18,165.34c-5.88,1.64-10.67-.07-15.48-3.19-1.51,1.6-3.15,2.96-4.78,2.92-2.2-.04-4.36-.89-5.9-3.13l31.97-18.18c-.24,2.24-1.51,3.84-2.71,5.48-3.41,4.66-4.57,10.02-3.11,16.1Z', 'M139.03,214.69c2.85,7.19,2.17,14.34-1.99,21.02-6.57,10.56-19.12,12.58-30.58,5.01-10.94-7.22-12.26-24.52-1.57-32.71l27.13-17.29c2.84,3.27-1.59,8.71-6.21,12.94,6.08,1.32,10.81,4.93,13.23,11.03ZM125.6,202.43c-.01-1.2-.78-2.06-1.47-1.9-1,.22-1.77.57-2.73,1.68l4.2.22ZM123,209.88c2.39-.86,4.82-1.05,7-3.22-2.75-1.46-5.31-.22-7.8.95-4.59,2.16-9.23,4.16-12.11,8.94,4.68,3.03,5.93-4.15,12.91-6.67ZM120.2,232.03c3.47-.53,5.56-3.81,6.14-6.07.81-3.22.05-6.41-2.24-8.47-1.53-1.37-3.57-1.53-5.47-.76-3.18,1.29-6.21,6.83-4.2,11.49.76,1.77,2.89,4.25,5.78,3.81Z', 'M92.89,226.83c-9.16,1.54-20.08-4.02-20.83-13.31,8.33,1.06,15.44.6,23.32-1.96-2.2,5.19-3.29,9.07-2.49,15.27Z'];

const getSpotPinIcon = (zoom: number = ZOOM_FOR_MAX_SCALE, selected: boolean = false, isLight: boolean = true) => {
  const theme = isLight ? SPOT_PIN_THEMES.light : SPOT_PIN_THEMES.dark;
  // En oscuro no hay variante sólida: sólo se entregó el pin con disco.
  const withDisc = isLight ? selected : true;
  const scale = getPinScale(zoom) * (selected ? SELECTED_PIN_GROWTH : 1);
  const height = (35 * scale).toFixed(1);
  const width = (28.3 * scale).toFixed(1);
  // Los dos juegos de trazos del skater difieren en ~2,5 unidades sobre un
  // lienzo de 301, así que la versión con disco reutiliza SKATER_INSET en
  // ambos temas: a tamaño de marcador el desplazamiento es sub-píxel.
  const figure = (withDisc ? SKATER_INSET : SKATER_SOLID)
    .map(d => `<path d="${d}" fill="${withDisc ? theme.onDisc : theme.onSolid}"/>`)
    .join('');
  const disc = withDisc
    ? `<circle cx="150.78" cy="151.62" r="135.9" fill="${theme.disc}"/><circle cx="150.78" cy="151.62" r="124.45" fill="none" stroke="${theme.ring}" stroke-width="5"/>`
    : '';
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 301.57 372.42" xmlns="http://www.w3.org/2000/svg"><ellipse cx="150.78" cy="356" rx="48" ry="13" fill="black" fill-opacity="0.3"/><path d="${PIN_SHAPE}" fill="${theme.pin}"/>${disc}${figure}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const getUserLocationIcon = () => {
  const svg = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" fill="${MARKER_GREEN}" fill-opacity="0.25"/><circle cx="11" cy="11" r="6" fill="${MARKER_GREEN}" stroke="white" stroke-width="2"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Challenge defs come from the server (server.ts CHALLENGE_DEFS) as plain
// data, so they can't carry a React component - map id -> icon locally.
const CHALLENGE_ICONS: Record<string, React.ElementType> = {
  'primer-spot': MapPin,
  'explorador-frecuente': Sparkles,
  'explorador-legendario': Flame,
  'fotografo-urbano': Camera,
  'voz-comunidad': MessageCircle,
};

// El desafío con más XP se destaca con fondo de color en vez de la tarjeta
// oscura estándar, para que la grilla de desafíos no se vea tan plana.
const FEATURED_CHALLENGE_ID = 'explorador-legendario';

const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void; disabled?: boolean }> = ({ on, onToggle, disabled }) => (
  <button
    onClick={disabled ? undefined : onToggle}
    disabled={disabled}
    className={cn(
      "shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors",
      disabled ? "bg-slate-800 opacity-60 cursor-not-allowed light:bg-slate-300" : on ? "bg-[#a3ff12] light:bg-[#96ab79]" : "bg-slate-700 light:bg-black"
    )}
    role="switch"
    aria-checked={on}
  >
    <div
      className={cn(
        "w-5 h-5 rounded-full bg-white shadow-md transition-transform",
        on ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
);

interface MobileLayoutProps {
  user: FirebaseUser | null;
  isAdmin: boolean;
  handleSignOut: () => void;
  setIsGuest: (v: boolean) => void;
  myProfile: UserProfile | null;
  myChallenges: ChallengesResponse | null;
  posts: CommunityPost[];
  myActivity: ActivityItem[];
  mySpots: Spot[];
  notifications: AppNotification[];
  attendingEventIds: string[];
  selectedEventAttendees: number;
  openPost: CommunityPost | null;
  openPostComments: PostComment[];
  isCreatingPost: boolean;
  setIsCreatingPost: (v: boolean) => void;
  publicProfile: PublicProfile | null;
  isLoadingPublicProfile: boolean;
  setPublicProfile: (p: PublicProfile | null) => void;
  handleToggleLike: (postId: string) => void;
  handleCreatePost: (post: { image_url: string; caption?: string; tags?: string[]; spot_id?: string | null }) => Promise<void>;
  handleDeletePost: (postId: string) => void;
  handleOpenPost: (post: CommunityPost) => void;
  handleAddComment: (text: string) => Promise<void>;
  handleToggleAttendance: (eventId: string) => void;
  handleOpenPublicProfile: (uid: string) => void;
  closePost: () => void;
  handleToggleFavorite: (spotId: string) => void;
  handleUpdateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'city' | 'discipline' | 'bio' | 'photoURL' | 'bannerURL' | 'instagram'>>) => Promise<UserProfile>;
  handleVisitSpot: (spotId: string) => Promise<boolean>;
  map: any;
  mapZoom: number;
  mapTypePreference: 'oscuro' | 'claro';
  setMapTypePreference: (fn: (p: 'oscuro' | 'claro') => 'oscuro' | 'claro') => void;
  geocodingLib: any;
  spots: Spot[];
  events: UrbanEvent[];
  filteredSpots: Spot[];
  pendingVideos: VideoClip[];
  spotPhotos: SpotPhoto[];
  spotReviews: SpotReview[];
  eventPhotos: EventPhoto[];
  eventReviews: EventReview[];
  currentUserLocation: { lat: number; lng: number } | null;
  userLocation: { lat: number; lng: number };
  selectedSpot: Spot | null;
  setSelectedSpot: (s: Spot | null) => void;
  selectedEvent: UrbanEvent | null;
  setSelectedEvent: (e: UrbanEvent | null) => void;
  isAddingSpot: boolean;
  setIsAddingSpot: (v: boolean) => void;
  newSpotCoords: { lat: number; lng: number } | null;
  setNewSpotCoords: (c: { lat: number; lng: number } | null) => void;
  showAdminPanel: boolean;
  setShowAdminPanel: (v: boolean) => void;
  activeTab: 'map' | 'list' | 'events' | 'admin' | 'community' | 'profile';
  setActiveTab: (t: 'map' | 'list' | 'events' | 'admin' | 'community' | 'profile') => void;
  showMobileOverlay: boolean;
  setShowMobileOverlay: (v: boolean) => void;
  isOverlayMinimized: boolean;
  setIsOverlayMinimized: (v: boolean) => void;
  addressSearch: string;
  setAddressSearch: (v: string) => void;
  mapSearchQuery: string;
  setMapSearchQuery: (v: string) => void;
  showMapFilter: boolean;
  setShowMapFilter: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeCategoryFilter: string | null;
  setActiveCategoryFilter: (v: string | null) => void;
  handleLocateUser: () => void;
  isLocating: boolean;
  parseCategories: (catString?: string) => string;
  fetchSpotPhotos: (id: string) => void;
  fetchSpotReviews: (id: string) => void;
  fetchEventPhotos: (id: string) => void;
  fetchEventReviews: (id: string) => void;
  handleAddSpot: (data: Partial<Spot>) => Promise<void>;
  handleUploadSpotPhoto: (dataUrl: string) => Promise<void>;
  handleSubmitReview: (rating: number, comment: string) => Promise<void>;
  handleUploadEventPhoto: (dataUrl: string) => Promise<void>;
  handleSubmitEventReview: (rating: number, comment: string) => Promise<void>;
  handleDeleteSpot: (id: string) => void;
  handleDeleteEvent: (id: string) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  setIsUploading: (v: boolean) => void;
  setRouteTarget: (t: { lat: number; lng: number; name: string; type?: 'spot' | 'event' } | null) => void;
  onMapClick: (e: any) => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  user, isAdmin, handleSignOut, setIsGuest,
  myProfile, myChallenges, handleToggleFavorite, handleUpdateProfile, handleVisitSpot,
  posts, myActivity, mySpots, notifications, attendingEventIds, selectedEventAttendees,
  openPost, openPostComments, isCreatingPost, setIsCreatingPost,
  publicProfile, isLoadingPublicProfile, setPublicProfile,
  handleToggleLike, handleCreatePost, handleDeletePost, handleOpenPost,
  handleAddComment, handleToggleAttendance, handleOpenPublicProfile, closePost,
  map, geocodingLib, mapZoom, mapTypePreference, setMapTypePreference,
  spots, events, filteredSpots, pendingVideos,
  spotPhotos, spotReviews, eventPhotos, eventReviews,
  currentUserLocation, userLocation,
  selectedSpot, setSelectedSpot, selectedEvent, setSelectedEvent,
  isAddingSpot, setIsAddingSpot, newSpotCoords, setNewSpotCoords,
  showAdminPanel, setShowAdminPanel, activeTab, setActiveTab,
  showMobileOverlay, setShowMobileOverlay, isOverlayMinimized, setIsOverlayMinimized,
  addressSearch, setAddressSearch,
  mapSearchQuery, setMapSearchQuery, showMapFilter, setShowMapFilter,
  activeCategoryFilter, setActiveCategoryFilter,
  handleLocateUser, isLocating, parseCategories,
  fetchSpotPhotos, fetchSpotReviews, fetchEventPhotos, fetchEventReviews,
  handleAddSpot, handleUploadSpotPhoto, handleSubmitReview, handleUploadEventPhoto, handleSubmitEventReview,
  handleDeleteSpot, handleDeleteEvent, handleApprove, handleReject,
  setIsUploading, setRouteTarget, onMapClick,
}) => {
  const [profileTab, setProfileTab] = useState<'challenges' | 'favorites' | 'activity' | 'myspots'>('challenges');
  const [challengesSubTab, setChallengesSubTab] = useState<'active' | 'completed'>('active');

  // Snapshot of what the header's Perfil button was showing right before
  // it switched to Perfil, so pressing it again restores that exact view
  // (spot detail, event detail, Spots list, Eventos, or plain map) instead
  // of always dumping the user back on the bare map.
  const preProfileView = useRef<{
    tab: typeof activeTab;
    overlay: boolean;
    spot: Spot | null;
    event: UrbanEvent | null;
    addingSpot: boolean;
  } | null>(null);

  // Settings screen. "Unidades" (flips every "km" distance label to miles)
  // and "Tema" (toggles data-theme, see index.css for the light/dark CSS
  // variables) are real. The rest are visual/local-only: there's
  // no edit-profile persistence, no push notifications, no account-privacy
  // concept, and no help center yet. A backend/product pass would need to
  // persist these per-user instead of just in this component's state.
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [unitsPreference, setUnitsPreference] = useState<'km' | 'mi'>('km');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);

  // Sub-pantallas de Configuración (mockups en mockups/menu configuracion) -
  // Notificaciones/Privacidad/Centro de ayuda, igual de mock que lo de
  // arriba: cambian en pantalla pero no se guardan en ningún backend.
  const [settingsSubView, setSettingsSubView] = useState<'notifications' | 'privacy' | 'help' | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifNewSpotsNearby, setNotifNewSpotsNearby] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifMySpotsActivity, setNotifMySpotsActivity] = useState(true);
  const [notifQuietHours, setNotifQuietHours] = useState(true);
  const NOTIF_RADIUS_OPTIONS_KM = [1, 3, 5, 10];
  const [notifRadiusKm, setNotifRadiusKm] = useState(3);
  // Por defecto en false (ubicación aproximada) - es el default más
  // respetuoso de la privacidad para un mapa público de spots.
  const [exactLocationEnabled, setExactLocationEnabled] = useState(false);
  const [helpSearchQuery, setHelpSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(HELP_FAQS[0].id);
  const filteredFaqs = helpSearchQuery.trim()
    ? HELP_FAQS.filter(f => f.question.toLowerCase().includes(helpSearchQuery.trim().toLowerCase()))
    : HELP_FAQS;

  const formatDistance = (km: number) => (
    unitsPreference === 'mi' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`
  );

  // Región chilena a partir de location_name ("Ciudad, Región" - ver
  // server.ts). Los spots de la Región Metropolitana vienen con distintos
  // formatos ("Providencia, Santiago", "Santiago Centro", "Parque
  // O'Higgins, Santiago Centro", "...Las Condes") así que se normalizan
  // todos a "Santiago" - Las Condes es una comuna de Santiago, no otra región.
  const regionFromLocationName = (locationName?: string | null) => {
    if (!locationName) return 'Otras';
    const parts = locationName.split(',').map(p => p.trim());
    const last = parts[parts.length - 1] || '';
    if (last.startsWith('Santiago') || last === 'Las Condes') return 'Santiago';
    return last || 'Otras';
  };

  // Shared card for the "Chile" grid below (flat or grouped by region -
  // same card either way, so it's factored out instead of duplicated).
  // Grilla de 3 columnas con grid-flow-dense (igual patrón que "Todos los
  // eventos" más abajo): isWide reparte tarjetas de 2 columnas entre las de
  // 1, así los anchos varían. La foto usa una altura fija (no aspect-square)
  // para que el alto no dependa del ancho de la tarjeta - así todas las
  // tarjetas de una misma fila quedan a la misma altura sin importar cuántas
  // columnas ocupen.
  const renderChileSpotCard = (spot: Spot, distanceKm: number, isWide: boolean) => (
    spot.image_url ? (
      <button
        key={spot.id}
        onClick={() => openSpot(spot)}
        className={cn("flex flex-col bg-slate-800/50 border border-slate-800 rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left light:bg-white", isWide ? "col-span-2" : "col-span-1")}
      >
        <img
          src={spot.image_url}
          alt={spot.name}
          className="w-full h-28 object-cover bg-slate-900"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
        <div className="p-2.5 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 light:text-black">{spot.name}</h3>
          <p className="text-xs text-[#a3ff12] font-semibold mt-1 light:text-[#96ab79]">{formatDistance(distanceKm)}</p>
          <div className="flex items-center justify-between mt-1.5 gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono truncate light:text-slate-600">{parseCategories(spot.category)}</span>
            {spot.review_count ? (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3 h-3 text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]" />
                <span className="text-xs font-semibold text-white light:text-black">{spot.rating!.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </button>
    ) : (
      <button
        key={spot.id}
        onClick={() => openSpot(spot)}
        className={cn("flex flex-col justify-between bg-slate-800/50 border border-slate-800 rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left p-3 light:bg-white light:border-black", isWide ? "col-span-2" : "col-span-1")}
      >
        <TriangleAlert className="w-6 h-6 text-slate-600 light:text-black" />
        <div>
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 light:text-black">{spot.name}</h3>
          <p className="text-xs text-[#a3ff12] font-semibold mt-1 mb-2 light:text-[#96ab79]">{formatDistance(distanceKm)}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase border border-slate-700 rounded-full px-2 py-1 text-slate-300 light:border-black light:text-black">
            <Camera className="w-3 h-3" /> Subir foto
          </span>
        </div>
      </button>
    )
  );

  const isLight = mapTypePreference === 'claro';

  // Spot/Evento map legend - doubles as a filter: null shows both, 'spot'
  // hides event markers, 'evento' hides spot markers. Clicking the active
  // one again clears back to null (both).
  const [mapMarkerFilter, setMapMarkerFilter] = useState<'spot' | 'evento' | null>(null);

  // Nearby Spots Peek (root map view) - all filtered spots ranked by
  // distance; the peek shows the closest 3, and in light theme the same
  // ranking numbers the square map markers so they match the list.
  const [isNearbyPeekMinimized, setIsNearbyPeekMinimized] = useState(false);
  const rankedSpots = [...filteredSpots]
    .map(spot => ({
      spot,
      distanceKm: getDistanceKm(
        (currentUserLocation || userLocation).lat,
        (currentUserLocation || userLocation).lng,
        spot.lat,
        spot.lng
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const nearbySpots = rankedSpots.slice(0, 3);
  const selectedSpotOpenState = getOpenState(selectedSpot?.open_hours);
  // Un solo data URI por render, compartido por los 126 marcadores.
  const metroIcon = getMetroIcon(mapZoom);

  // Al abrir otro spot o evento la hoja conserva el scroll del anterior, así
  // que un detalle abierto desde "spots relacionados" (que está al final)
  // aparecía ya scrolleado abajo. Siempre se parte desde arriba.
  const detailScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedSpot || selectedEvent) detailScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedSpot?.id, selectedEvent?.id]);

  const [showSpotFilters, setShowSpotFilters] = useState(false);
  const [filterSpotType, setFilterSpotType] = useState<NonNullable<Spot['spot_type']> | null>(null);
  const [filterFeatures, setFilterFeatures] = useState<string[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState<NonNullable<Spot['difficulty']> | null>(null);
  const [filterMinRating, setFilterMinRating] = useState<number | null>(null);

  const clearSpotFilters = () => {
    setFilterSpotType(null);
    setFilterFeatures([]);
    setFilterDifficulty(null);
    setFilterMinRating(null);
  };

  const activeFilterCount =
    (filterSpotType ? 1 : 0) + filterFeatures.length + (filterDifficulty ? 1 : 0) + (filterMinRating ? 1 : 0);

  const filteredSpotsList = spots.filter(spot => {
    if (filterSpotType && spot.spot_type !== filterSpotType) return false;
    if (filterFeatures.length > 0 && !filterFeatures.every(f => spot.features?.includes(f))) return false;
    if (filterDifficulty && spot.difficulty !== filterDifficulty) return false;
    if (filterMinRating && (!spot.rating || spot.rating < filterMinRating)) return false;
    return true;
  });

  // "Spots" tab feed - quick inline search + category pills (separate from
  // the deep filter panel above, which still layers on top via
  // filteredSpotsList). Category counts use the full `spots` list (not the
  // filtered one) since they're meant to read as totals, like "SKATE · 61".
  const [spotsSearchQuery, setSpotsSearchQuery] = useState('');
  const [spotsCategoryFilter, setSpotsCategoryFilter] = useState<string | null>(null);
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [showChileSpots, setShowChileSpots] = useState(false);
  const [chileRegionFilter, setChileRegionFilter] = useState<string | null>(null);
  const feedOrigin = currentUserLocation || userLocation;

  // "Eventos" tab - hero destacado (todos los eventos, swipeable) +
  // carrusel de próximos + grilla "Todos los eventos" tipo masonry, para
  // que no se vea como una sola lista repetitiva de filas.
  const [eventsSearchOpen, setEventsSearchOpen] = useState(false);
  const [eventsSearchQuery, setEventsSearchQuery] = useState('');
  const [eventsFilterOpen, setEventsFilterOpen] = useState(false);
  const [eventsCategoryFilter, setEventsCategoryFilter] = useState<string | null>(null);
  const [eventsAvailableOnly, setEventsAvailableOnly] = useState(false);
  const [heroEventIndex, setHeroEventIndex] = useState(0);
  const [showAllEventsGrid, setShowAllEventsGrid] = useState(false);
  // Cuántas tarjetas caben en las primeras 3 filas de la grilla de abajo
  // (grid-cols-3, dense) dado el patrón de ancho variable (1 de cada 4 gasta
  // 2 columnas) - los primeros 7 ítems llenan exactamente 3 filas sin dejar
  // huecos. Si ese patrón cambia, este número hay que recalcularlo a mano.
  const EVENTS_GRID_COLLAPSED_COUNT = 7;
  const heroScrollRef = React.useRef<HTMLDivElement>(null);
  // Carrusel "Destacado" de spots (después de "Explorar por país") - índice
  // y ref propios, separados de heroEventIndex/heroScrollRef de arriba
  // porque son dos carruseles distintos (tabs distintos).
  const [spotsHeroIndex, setSpotsHeroIndex] = useState(0);
  const spotsHeroScrollRef = React.useRef<HTMLDivElement>(null);
  const upcomingScrollRef = React.useRef<HTMLDivElement>(null);

  const upcomingEvents = events.filter(e => e.available !== false);
  const eventCategories = Array.from(new Set(events.map(e => e.category).filter(Boolean))) as string[];
  const filteredEvents = events.filter(e => {
    if (eventsAvailableOnly && e.available === false) return false;
    if (eventsCategoryFilter && e.category !== eventsCategoryFilter) return false;
    if (eventsSearchQuery.trim()) {
      const q = eventsSearchQuery.trim().toLowerCase();
      const matches = [e.title, e.location_name].filter(Boolean).some(f => f!.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });
  const scrollCarouselBy = (ref: React.RefObject<HTMLDivElement>, dir: 1 | -1, fraction = 0.8) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * fraction, behavior: 'smooth' });
  };
  const NEARBY_RADIUS_KM = 5;

  const spotsFeedBase = filteredSpotsList.filter(spot => {
    if (spotsCategoryFilter && !(spot.category || '').includes(spotsCategoryFilter)) return false;
    if (spotsSearchQuery.trim()) {
      const q = spotsSearchQuery.trim().toLowerCase();
      const matches = [spot.name, spot.location_name].filter(Boolean).some(f => f!.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  const spotsWithDistance = spotsFeedBase
    .map(spot => ({ spot, distanceKm: getDistanceKm(feedOrigin.lat, feedOrigin.lng, spot.lat, spot.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyWithinRadius = spotsWithDistance.filter(x => x.distanceKm <= NEARBY_RADIUS_KM);
  const nearbyToShow = showAllNearby ? nearbyWithinRadius : nearbyWithinRadius.slice(0, 2);

  const categoryCount = (categoryId: string) => spots.filter(s => (s.category || '').includes(categoryId)).length;

  const noPhotoSpots = spotsFeedBase.filter(s => !s.image_url);

  const newThisWeekCount = spots.filter(s => {
    const created = toDate(s.createdAt);
    if (!created) return false;
    return (Date.now() - created.getTime()) / 86400000 <= 7;
  }).length;

  const activeNowList = MOCK_ACTIVE_NOW
    .map(m => ({ ...m, spot: spots.find(s => s.id === m.spotId) }))
    .filter((x): x is typeof x & { spot: Spot } => !!x.spot);

  const featuredSpot = spots.find(s => s.id === MOCK_FEATURED_SPOT_ID);
  const featuredEvent = featuredSpot
    ? events.find(e => getDistanceKm(featuredSpot.lat, featuredSpot.lng, e.lat, e.lng) < 1)
    : undefined;

  const featuredAndNearbyIds = new Set([...nearbyToShow.map(x => x.spot.id), featuredSpot?.id].filter(Boolean));
  const restOfGrid = spotsWithDistance.filter(x => !featuredAndNearbyIds.has(x.spot.id));

  // Carrusel "Destacado" bajo "Explorar por país" - los spots con foto mejor
  // valorados (rating real, no un pick fijo como featuredSpot arriba), top 10.
  const destacadosCarousel = restOfGrid
    .filter(({ spot }) => !!spot.image_url)
    .sort((a, b) => (b.spot.rating ?? 0) - (a.spot.rating ?? 0))
    .slice(0, 10);

  const newSpotsCarousel = NEW_SPOTS_CAROUSEL_IDS
    .map(id => spots.find(s => s.id === id))
    .filter((s): s is Spot => !!s);

  // Regiones dentro del listado "Chile" (orden = primera aparición, ya que
  // restOfGrid viene ordenado por cercanía) - así la chip bar y las
  // secciones agrupadas evitan el scroll eterno de antes.
  const chileRegions: string[] = [];
  for (const { spot } of restOfGrid) {
    const region = regionFromLocationName(spot.location_name);
    if (!chileRegions.includes(region)) chileRegions.push(region);
  }
  const chileGridItems = chileRegionFilter
    ? restOfGrid.filter(({ spot }) => regionFromLocationName(spot.location_name) === chileRegionFilter)
    : restOfGrid;
  // Grouped under a region header when no chip is selected (breaks the
  // long list into chunks); a single flat grid once a chip narrows it down
  // to one region, since the header would just repeat the chip label.
  const chileGroupedItems: [string, typeof restOfGrid][] = [];
  if (!chileRegionFilter) {
    for (const item of chileGridItems) {
      const region = regionFromLocationName(item.spot.location_name);
      let bucket = chileGroupedItems.find(([r]) => r === region);
      if (!bucket) {
        bucket = [region, []];
        chileGroupedItems.push(bucket);
      }
      bucket[1].push(item);
    }
  }

  const openSpot = (spot: Spot) => {
    setSelectedSpot(spot);
    setSelectedEvent(null);
    fetchSpotPhotos(spot.id);
    fetchSpotReviews(spot.id);
    if (map) {
      map.panTo({ lat: spot.lat, lng: spot.lng });
      map.setZoom(16);
    }
  };

  // Abre un spot desde el perfil (Actividad / Mis spots) o desde una
  // notificación: la hoja ya está abierta, sólo cambiamos su contenido.
  const openSpotFromProfile = (spot: Spot) => {
    setSelectedSpot(spot);
    setSelectedEvent(null);
    setActiveTab('list');
    setShowMobileOverlay(true);
    fetchSpotPhotos(spot.id);
    fetchSpotReviews(spot.id);
  };

  const openSpotById = (spotId: string) => {
    const spot = spots.find(s => s.id === spotId);
    if (spot) openSpotFromProfile(spot);
  };

  // From the events list inside the sheet: the sheet is already open, just
  // collapse it to a peek so the detail is visible underneath.
  const openEventFromList = (event: UrbanEvent) => {
    setSelectedEvent(event);
    setSelectedSpot(null);
    fetchEventPhotos(event.id);
    fetchEventReviews(event.id);
    setIsOverlayMinimized(true);
    if (map) {
      map.panTo({ lat: event.lat, lng: event.lng });
      map.setZoom(15);
    }
  };

  return (
    <div className="md:hidden flex-1 relative z-10 flex flex-col">
      {/* Mobile Header - flota sobre el mapa (fixed, sin fondo sólido de
          ancho completo) igual que la barra inferior, así el mapa llega
          hasta el borde superior real de la pantalla. Sigue siendo visible
          en todas las pestañas, no solo en el mapa. */}
      <div className="fixed top-4 inset-x-4 z-[3000] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 select-none">
          <Wordmark iconSize="md" textClassName="text-xl" lightClassName="h-6" />
          {isAdmin && <ShieldCheck className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'profile' && showMobileOverlay) {
                const prev = preProfileView.current;
                preProfileView.current = null;
                if (prev) {
                  setActiveTab(prev.tab);
                  setShowMobileOverlay(prev.overlay);
                  setSelectedSpot(prev.spot);
                  setSelectedEvent(prev.event);
                  setIsAddingSpot(prev.addingSpot);
                } else {
                  setActiveTab('map'); setShowMobileOverlay(false);
                }
              } else {
                preProfileView.current = { tab: activeTab, overlay: showMobileOverlay, spot: selectedSpot, event: selectedEvent, addingSpot: isAddingSpot };
                setActiveTab('profile'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
              }
            }}
            className={cn(
              "p-2.5 rounded-2xl shadow-lg active:scale-95 transition-all",
              activeTab === 'profile' && showMobileOverlay
                ? "bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                : "bg-white/95 backdrop-blur-md text-slate-800"
            )}
            title="Perfil"
          >
            {user ? (
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                className="w-5 h-5 rounded-full"
                alt="Perfil"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-900 p-10 text-center">
            <div className="max-w-md space-y-4">
              <MapPin className="w-12 h-12 text-slate-700 mx-auto" />
              <h2 className="text-xl font-semibold">Se requiere una API Key de Google Maps</h2>
              <p className="text-slate-400 text-sm">
                Por favor, añade tu API Key de Google Maps a las variables de entorno como <code className="bg-slate-800 px-1 rounded text-emerald-400">VITE_GOOGLE_MAPS_API_KEY</code> para habilitar el mapa.
              </p>
            </div>
          </div>
        ) : (
          <Map
            defaultCenter={userLocation}
            defaultZoom={13}
            styles={isLight ? MAP_STYLES_LIGHT : MAP_STYLES}
            onClick={onMapClick}
            className={cn("w-full h-full", isLight ? "google-map-light" : "google-map-dark")}
            disableDefaultUI={true}
            gestureHandling={'greedy'}
            clickableIcons={false}
          >
            {/* Estaciones de metro: referencia visual, no interactivas -
                clickable={false} evita que roben el toque a un pin de spot
                cercano, y el zIndex las deja por debajo. */}
            {!isLight && mapZoom >= MIN_ZOOM_FOR_METRO && METRO_STATIONS.map(station => (
              <Marker
                key={`metro-${station.name}`}
                position={{ lat: station.lat, lng: station.lng }}
                title={station.name}
                icon={metroIcon}
                clickable={false}
                zIndex={1}
              />
            ))}

            {mapMarkerFilter !== 'evento' && rankedSpots.map(({ spot }) => (
              <Marker
                key={spot.id}
                position={{ lat: spot.lat, lng: spot.lng }}
                title={spot.name}
                icon={getSpotPinIcon(mapZoom, selectedSpot?.id === spot.id, isLight)}
                zIndex={selectedSpot?.id === spot.id ? 100 : undefined}
                onClick={() => {
                  setSelectedSpot(spot);
                  setSelectedEvent(null);
                  fetchSpotPhotos(spot.id);
                  fetchSpotReviews(spot.id);
                }}
              />
            ))}

            {mapMarkerFilter !== 'spot' && events.map(event => (
              <Marker
                key={`event-${event.id}`}
                position={{ lat: event.lat, lng: event.lng }}
                title={event.title}
                icon={isLight ? getMarkerIcon(LIGHT_EVENT_COLOR, true, mapZoom) : getEventPinIcon(mapZoom, selectedEvent?.id === event.id)}
                onClick={() => {
                  setSelectedEvent(event);
                  setSelectedSpot(null);
                  fetchEventPhotos(event.id);
                  fetchEventReviews(event.id);
                }}
              />
            ))}

            {newSpotCoords && (
              <Marker position={newSpotCoords} icon={getMarkerIcon(isLight ? LIGHT_ACCENT : MARKER_ORANGE, true, mapZoom)} />
            )}

            {currentUserLocation && (
              <Marker position={currentUserLocation} title="Tu ubicación" icon={getUserLocationIcon()} />
            )}
          </Map>
        )}

        {/* Floating Search Bar - root map view only */}
        {activeTab === 'map' && !showMobileOverlay && !isAddingSpot && (
          <div className="absolute top-20 inset-x-4 z-[1000] space-y-2">
            <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-full pl-4 pr-1.5 h-11 light:bg-white light:border-black">
              <Search className="w-4 h-4 text-slate-400 shrink-0 light:text-black" />
              <input
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder="Buscar en esta área"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none min-w-0 light:text-black light:placeholder:text-slate-500"
              />
              <button
                onClick={() => setShowMapFilter(v => !v)}
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95",
                  showMapFilter || activeCategoryFilter
                    ? "bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                    : "text-[#a3ff12] light:text-[#96ab79]"
                )}
                aria-label="Filtrar"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Spot/Evento map legend - also doubles as a filter (see
                mapMarkerFilter above): tap one to show only that marker type,
                tap it again to go back to showing both. Pegado a la barra de
                búsqueda en vez de flotar más abajo. */}
            <div className="w-fit flex items-center gap-3 px-1 py-1 text-xs font-semibold text-white light:text-black">
              <button
                onClick={() => setMapMarkerFilter(f => f === 'spot' ? null : 'spot')}
                className={cn("flex items-center gap-1.5 transition-opacity", mapMarkerFilter === 'evento' && "opacity-40")}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isLight ? LIGHT_ACCENT : MARKER_GREEN }} />
                SPOT
              </button>
              <button
                onClick={() => setMapMarkerFilter(f => f === 'evento' ? null : 'evento')}
                className={cn("flex items-center gap-1.5 transition-opacity", mapMarkerFilter === 'spot' && "opacity-40")}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isLight ? LIGHT_EVENT_COLOR : MARKER_ORANGE }} />
                EVENTO
              </button>
            </div>

            <AnimatePresence>
              {showMapFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex gap-2 overflow-x-auto no-scrollbar"
                >
                  <button
                    onClick={() => setActiveCategoryFilter(null)}
                    className={cn(
                      "shrink-0 text-xs font-semibold px-3 py-2 rounded-full border transition-all",
                      !activeCategoryFilter ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900/90 border-slate-800 text-slate-300 light:bg-white light:border-black light:text-black"
                    )}
                  >
                    Todos
                  </button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryFilter(cat.id)}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition-all",
                        activeCategoryFilter === cat.id ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900/90 border-slate-800 text-slate-300 light:bg-white light:border-black light:text-black"
                      )}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Locate Button */}
        <div className="absolute top-52 right-4 z-[1000]">
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl text-white active:scale-95 transition-all disabled:opacity-60 light:bg-white light:border-black light:shadow-none light:text-black"
          >
            {isLocating ? (
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin light:border-[#96ab79]" />
            ) : (
              <Locate className="w-6 h-6 text-emerald-500 light:text-[#96ab79]" />
            )}
          </button>
        </div>

        {/* Compact Spot Preview Card - shown when a marker is tapped on the
            root map view. mode="wait" so tapping a different spot while one
            is already open closes it first instead of the two overlapping
            mid-transition. */}
        <AnimatePresence mode="wait">
          {selectedSpot && activeTab === 'map' && !showMobileOverlay && !isAddingSpot && (
            <motion.div
              key={selectedSpot.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              onClick={() => setShowMobileOverlay(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMobileOverlay(true); }}
              className="absolute bottom-28 inset-x-4 z-[1000] h-36 rounded-[28px] overflow-hidden shadow-2xl text-left active:scale-[0.98] transition-all cursor-pointer bg-slate-900/95 backdrop-blur-xl border border-white/10 light:bg-[#96ab79] light:border-transparent light:shadow-none"
            >
              {/* La foto ocupa la mitad izquierda y se funde con el fondo de
                  la tarjeta mediante un degradado, en vez de ir recortada en
                  su propio recuadro. */}
              <div className="absolute inset-y-0 left-0 w-[52%]">
                <img
                  src={selectedSpot.image_url || PLACEHOLDER_IMAGE}
                  alt={selectedSpot.name}
                  className="w-full h-full object-cover bg-slate-800"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/50 to-slate-900 light:via-[#96ab79]/50 light:to-[#96ab79]" />
              </div>

              {/* Favorito y estado del lugar van juntos sobre la foto: así la
                  columna de texto se queda con una fila menos y el nombre cabe
                  en dos líneas sin recortarse a media letra. */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 max-w-[calc(52%-2rem)]">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(selectedSpot.id); }}
                  className="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  aria-label={(myProfile?.favorites ?? []).includes(selectedSpot.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                >
                  <Heart className={cn('w-4 h-4 transition-colors',
                    (myProfile?.favorites ?? []).includes(selectedSpot.id)
                      ? 'text-[#96ab79] fill-[#96ab79]'
                      : 'text-black')} />
                </button>
                {/* Sólo aparece cuando el horario del spot permite saberlo -
                    la mayoría del catastro no trae open_hours. */}
                {selectedSpotOpenState && (
                  <span className={cn(
                    'shrink-0 bg-white rounded-full px-2.5 py-1 text-[11px] font-bold capitalize shadow-lg',
                    selectedSpotOpenState === 'abierto' ? 'text-[#5f7245]' : 'text-slate-500'
                  )}>
                    {selectedSpotOpenState}
                  </span>
                )}
              </div>

              <div className="absolute inset-y-0 right-0 left-[46%] pr-11 pl-1 py-3 flex flex-col justify-center gap-1 overflow-hidden">
                <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">{selectedSpot.name}</h3>
                <p className="text-xs text-white/80">
                  {formatDistance(getDistanceKm(
                    (currentUserLocation || userLocation).lat,
                    (currentUserLocation || userLocation).lng,
                    selectedSpot.lat,
                    selectedSpot.lng
                  ))}
                </p>
                {spotCategoryLabels(selectedSpot.category).length > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    {spotCategoryLabels(selectedSpot.category).map((label, i) => (
                      <React.Fragment key={label}>
                        {i > 0 && <span className="text-white/40 text-[10px]" aria-hidden="true">|</span>}
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white truncate">{label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSpot(null); }}
                className="absolute top-3 right-3 p-2 text-white/80 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Event Preview Card - shown when a marker is tapped on the
            root map view. mode="wait" for the same reason as the spot card
            above. */}
        <AnimatePresence mode="wait">
          {selectedEvent && activeTab === 'map' && !showMobileOverlay && !isAddingSpot && (
            <motion.div
              key={selectedEvent.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              onClick={() => { setShowMobileOverlay(true); setActiveTab('events'); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowMobileOverlay(true); setActiveTab('events'); } }}
              className="absolute bottom-28 inset-x-4 z-[1000] h-36 rounded-[28px] overflow-hidden shadow-2xl text-left active:scale-[0.98] transition-all cursor-pointer bg-slate-900/95 backdrop-blur-xl border border-white/10 light:bg-[#d97e3f] light:border-transparent light:shadow-none"
            >
              {/* Mismo diseño que la tarjeta de spot, en el naranja de
                  eventos: foto fundida a la izquierda y los datos a la
                  derecha. */}
              <div className="absolute inset-y-0 left-0 w-[52%]">
                <img
                  src={selectedEvent.image_url || PLACEHOLDER_IMAGE}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover bg-slate-800"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/50 to-slate-900 light:via-[#d97e3f]/50 light:to-[#d97e3f]" />
              </div>

              {/* Los eventos no tienen favoritos, así que este espacio lo ocupa
                  la señal más útil: si la fecha ya pasó (available === false,
                  ver los eventos del informe en server.ts). */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 max-w-[calc(52%-2rem)]">
                <span className={cn(
                  'shrink-0 bg-white rounded-full px-3 py-1.5 text-[11px] font-bold capitalize shadow-lg',
                  selectedEvent.available === false ? 'text-slate-500' : 'text-[#b4622c]'
                )}>
                  {selectedEvent.available === false
                    ? 'Ya se realizó'
                    : new Date(selectedEvent.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="absolute inset-y-0 right-0 left-[46%] pr-11 pl-1 py-3 flex flex-col justify-center gap-1 overflow-hidden">
                <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">{selectedEvent.title}</h3>
                <p className="text-xs text-white/80 truncate">
                  {selectedEvent.location_name || 'Ubicación registrada'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white truncate">
                    {eventCategoryLabel(selectedEvent.category)}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setSelectedEvent(null); }}
                className="absolute top-3 right-3 p-2 text-white/80 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nearby Spots Peek - default state of the root map view: a
            half-out sheet listing the closest spots, collapsible via
            drag/tap. Hidden as soon as a marker is selected (the compact
            preview cards above take over that same bottom slot). */}
        <AnimatePresence>
          {activeTab === 'map' && !showMobileOverlay && !isAddingSpot && !selectedSpot && !selectedEvent && nearbySpots.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                if (info.offset.y > 40) setIsNearbyPeekMinimized(true);
                else if (info.offset.y < -40) setIsNearbyPeekMinimized(false);
              }}
              className="absolute bottom-28 inset-x-4 z-[1000] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden touch-none light:bg-white light:border-transparent light:shadow-none"
            >
              <button
                onClick={() => setIsNearbyPeekMinimized(v => !v)}
                className="w-full pt-3 pb-2 cursor-grab active:cursor-grabbing light:bg-[#96ab79]"
              >
                <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mb-1.5 light:bg-white/70" />
                <p className="text-[9px] text-slate-600 font-mono text-center uppercase tracking-widest light:text-white">
                  {isNearbyPeekMinimized ? 'Toca para expandir' : 'Desliza para minimizar'}
                </p>
              </button>

              <AnimatePresence initial={false}>
                {!isNearbyPeekMinimized && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/5 light:border-black">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest light:text-black">
                          {nearbySpots.length} spot{nearbySpots.length !== 1 ? 's' : ''} en esta zona
                        </p>
                        <button
                          onClick={() => { setActiveTab('list'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); }}
                          className="text-[10px] font-bold text-[#a3ff12] uppercase tracking-widest shrink-0 light:text-[#96ab79]"
                        >
                          Lista completa
                        </button>
                      </div>

                      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                        {nearbySpots.map(({ spot, distanceKm }, i) => (
                          <button
                            key={spot.id}
                            onClick={() => openSpot(spot)}
                            className="shrink-0 w-36 flex flex-col text-left active:scale-[0.97] transition-all"
                          >
                            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-800">
                              <img
                                src={spot.image_url || PLACEHOLDER_IMAGE}
                                alt={spot.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                              />
                              <span className="absolute top-1.5 left-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold light:bg-white light:text-black light:border light:border-black">
                                {i + 1}
                              </span>
                            </div>
                            <div className="pt-1.5 min-w-0">
                              <h4 className="text-xs font-semibold text-white truncate light:text-black">{spot.name}</h4>
                              <p className="text-[10px] mt-0.5 truncate">
                                <span className="text-[#a3ff12] font-semibold light:text-[#96ab79]">{formatDistance(distanceKm)}</span>
                                {spot.review_count ? (
                                  <span className="text-slate-500 light:text-slate-600"> · {spot.rating!.toFixed(1)}★</span>
                                ) : null}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Sheet / Overlay */}
        <AnimatePresence>
          {(showMobileOverlay || activeTab !== 'map') && (
            <motion.div
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 200) {
                  setShowMobileOverlay(false);
                  setActiveTab('map');
                  setSelectedSpot(null);
                  setSelectedEvent(null);
                  setIsAddingSpot(false);
                  setIsOverlayMinimized(false);
                } else if (info.offset.y < -50) {
                  setIsOverlayMinimized(false);
                } else if (info.offset.y > 50 && !isOverlayMinimized) {
                  setIsOverlayMinimized(true);
                }
              }}
              initial={{ y: '100%' }}
              animate={{ y: isOverlayMinimized ? '55%' : 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 top-20 bg-slate-900 z-[2000] rounded-t-[32px] border-t border-slate-800 overflow-hidden flex flex-col touch-none light:bg-white light:border-black"
            >
              <div ref={detailScrollRef} className="flex-1 overflow-y-auto pb-24 touch-pan-y">
                {/* Drag handle + hint - hidden while viewing a spot, or on
                    the Profile tab, so their own hero image/banner can go
                    all the way to the top edge (Profile renders its own
                    handle bar over the banner instead - see below). The
                    motion.div wrapping this whole sheet still has drag="y"
                    on it regardless, so dragging to minimize still works
                    from anywhere in the sheet, just without this visual cue. */}
                {!selectedSpot && activeTab !== 'profile' && (
                  <div
                    className="w-full pt-4 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
                    onClick={() => isOverlayMinimized && setIsOverlayMinimized(false)}
                  >
                    <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-2 light:bg-black" />
                    <p className="text-[10px] text-slate-600 font-mono text-center uppercase tracking-widest light:text-black">
                      {isOverlayMinimized ? 'Toca para expandir' : 'Desliza para minimizar'}
                    </p>
                  </div>
                )}

                <div className={cn("p-6", (selectedSpot || activeTab === 'profile') && "pt-0")}>
                  {isAddingSpot ? (
                    <AddSpotForm
                      onClose={() => {
                        setIsAddingSpot(false);
                        setNewSpotCoords(null);
                        setAddressSearch('');
                        setShowMobileOverlay(false);
                        setActiveTab('map');
                      }}
                      onSubmit={handleAddSpot}
                      newSpotCoords={newSpotCoords}
                      setNewSpotCoords={setNewSpotCoords}
                      geocodingLib={geocodingLib}
                      map={map}
                      setIsOverlayMinimized={setIsOverlayMinimized}
                    />
                  ) : selectedSpot ? (
                    <SpotDetail
                      spot={selectedSpot}
                      photos={spotPhotos}
                      reviews={spotReviews}
                      userLocation={currentUserLocation || userLocation}
                      onClose={() => {
                        setSelectedSpot(null);
                        setShowMobileOverlay(false);
                      }}
                      onUpload={() => setIsUploading(true)}
                      onUploadPhoto={handleUploadSpotPhoto}
                      onSubmitReview={handleSubmitReview}
                      onShowRoute={() => setRouteTarget({ lat: selectedSpot.lat, lng: selectedSpot.lng, name: selectedSpot.name, type: 'spot' })}
                      isAdmin={isAdmin}
                      onDelete={handleDeleteSpot}
                      isFavorite={(myProfile?.favorites ?? []).includes(selectedSpot.id)}
                      onToggleFavorite={() => handleToggleFavorite(selectedSpot.id)}
                      onVisit={() => handleVisitSpot(selectedSpot.id)}
                      relatedSpots={getRelatedSpots(selectedSpot, spots)}
                      onOpenSpot={openSpotFromProfile}
                      nearbyEvents={getNearbyEvents(selectedSpot, events)}
                      onOpenEvent={openEventFromList}
                    />
                  ) : selectedEvent ? (
                    <EventDetail
                      event={selectedEvent}
                      photos={eventPhotos}
                      reviews={eventReviews}
                      userLocation={currentUserLocation || userLocation}
                      onClose={() => {
                        setSelectedEvent(null);
                        setShowMobileOverlay(false);
                      }}
                      onShowRoute={() => setRouteTarget({ lat: selectedEvent.lat, lng: selectedEvent.lng, name: selectedEvent.title, type: 'event' })}
                      onUploadPhoto={handleUploadEventPhoto}
                      onSubmitReview={handleSubmitEventReview}
                      isAdmin={isAdmin}
                      onDelete={handleDeleteEvent}
                      isAttending={attendingEventIds.includes(selectedEvent.id)}
                      attendeeCount={selectedEventAttendees}
                      onToggleAttendance={() => handleToggleAttendance(selectedEvent.id)}
                      nearbySpots={getNearbySpots(selectedEvent, spots)}
                      onOpenSpot={openSpotFromProfile}
                    />
                  ) : activeTab === 'list' ? (
                    <div className="space-y-6">
                      {/* Search + deep filter panel trigger */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-slate-800/50 border border-slate-800 rounded-full px-4 h-11 light:bg-white light:border-black">
                          <Search className="w-4 h-4 text-slate-400 shrink-0 light:text-black" />
                          <input
                            value={spotsSearchQuery}
                            onChange={(e) => setSpotsSearchQuery(e.target.value)}
                            placeholder="Buscar spot, barrio o rider"
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none min-w-0 light:text-black light:placeholder:text-slate-500"
                          />
                        </div>
                        <button
                          onClick={() => setShowSpotFilters(true)}
                          className={cn(
                            "relative shrink-0 w-11 h-11 rounded-full border flex items-center justify-center transition-all active:scale-95",
                            activeFilterCount > 0
                              ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white"
                              : "bg-slate-800/50 border-slate-800 text-[#a3ff12] light:bg-white light:border-black light:text-[#96ab79]"
                          )}
                          aria-label="Filtrar spots"
                        >
                          <Filter className="w-5 h-5" />
                          {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold light:bg-black">
                              {activeFilterCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Category tabs - big bold text instead of small pills,
                          count sits above the label (full "N SPOTS" on the
                          active tab, just the bare number on the rest) with
                          an underline marking the active one. */}
                      <div className="flex gap-6 overflow-x-auto no-scrollbar items-end pb-0.5">
                        {([{ id: null as string | null, name: 'Todos', count: spots.length }, ...CATEGORIES.map(cat => ({ id: cat.id, name: cat.id === 'skate' ? 'Skate' : cat.name, count: categoryCount(cat.id) }))]).map(tab => {
                          const active = spotsCategoryFilter === tab.id;
                          return (
                            <button
                              key={tab.id ?? 'all'}
                              onClick={() => setSpotsCategoryFilter(tab.id)}
                              className="shrink-0 flex flex-col items-start"
                            >
                              <span className={cn(
                                "text-[10px] font-mono uppercase tracking-widest",
                                active ? "text-[#a3ff12] light:text-[#96ab79]" : "text-slate-600 light:text-slate-400"
                              )}>
                                {active ? `${tab.count} spots` : tab.count}
                              </span>
                              <span className={cn(
                                "font-display text-3xl uppercase tracking-tight leading-none transition-colors",
                                active ? "text-[#a3ff12] light:text-[#96ab79]" : "text-[#a3ff12]/20 light:text-[#96ab79]/25"
                              )}>
                                {tab.name}
                              </span>
                              <div className={cn("h-1 w-full rounded-full mt-2", active ? "bg-[#a3ff12] light:bg-[#96ab79]" : "bg-transparent")} />
                            </button>
                          );
                        })}
                      </div>

                      {spotsFeedBase.length === 0 ? (
                        <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-10 text-center light:bg-white light:border-black">
                          <Filter className="w-10 h-10 text-slate-800 mx-auto mb-3 light:text-slate-300" />
                          <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Sin resultados</p>
                          <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Prueba con otros filtros</p>
                        </div>
                      ) : (
                        <>
                          {/* Cerca de ti */}
                          {nearbyWithinRadius.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                  <h3 className="text-lg font-semibold text-white light:text-black">Cerca de ti</h3>
                                  <span className="text-xs text-slate-500 light:text-slate-600">{NEARBY_RADIUS_KM} km</span>
                                </div>
                                {nearbyWithinRadius.length > 2 && (
                                  <button
                                    onClick={() => setShowAllNearby(v => !v)}
                                    className="text-xs font-bold text-[#a3ff12] light:text-[#96ab79]"
                                  >
                                    {showAllNearby ? 'Ver menos' : `Ver ${nearbyWithinRadius.length} →`}
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {nearbyToShow.map(({ spot, distanceKm }) => (
                                  <button
                                    key={spot.id}
                                    onClick={() => openSpot(spot)}
                                    className="relative w-full flex flex-col bg-slate-800/50 border border-slate-800 rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left light:bg-white"
                                  >
                                    <img
                                      src={spot.image_url || PLACEHOLDER_IMAGE}
                                      alt={spot.name}
                                      className="w-full h-28 object-cover bg-slate-900"
                                      referrerPolicy="no-referrer"
                                      onError={handleImageError}
                                    />
                                    {MOCK_NEARBY_RIDER_BADGE[spot.id] && (
                                      <span className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white text-[9px] font-semibold px-2 py-1 rounded-full light:bg-white light:text-black light:border light:border-black">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#a3ff12] light:bg-[#96ab79]" />
                                        {MOCK_NEARBY_RIDER_BADGE[spot.id]} RIDERS
                                      </span>
                                    )}
                                    <div className="p-2.5 min-w-0">
                                      <h3 className="font-semibold text-white text-sm leading-tight truncate light:text-black">{spot.name}</h3>
                                      <p className="text-xs mt-1">
                                        <span className="text-[#a3ff12] font-semibold light:text-[#96ab79]">{formatDistance(distanceKm)}</span>
                                        {' · '}
                                        <span className="text-slate-500 uppercase font-mono light:text-slate-600">{parseCategories(spot.category)}</span>
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Weekly banner - real count from spot.createdAt */}
                          {newThisWeekCount > 0 && (
                            <div className="w-full bg-[#a3ff12] rounded-3xl p-5 flex items-center justify-between light:bg-[#96ab79]">
                              <div>
                                <p className="text-[10px] font-bold text-black/60 uppercase tracking-widest light:text-white/70">Esta semana</p>
                                <p className="text-2xl font-bold text-black leading-tight light:text-white">{newThisWeekCount} spots<br />nuevos</p>
                              </div>
                              <ArrowUpRight className="w-8 h-8 text-black light:text-white" />
                            </div>
                          )}

                          {/* Activos ahora - MOCK DATA, see MOCK_ACTIVE_NOW in constants.tsx */}
                          {activeNowList.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[#a3ff12] animate-pulse light:bg-[#96ab79]" />
                                  <h3 className="text-lg font-semibold text-white light:text-black">Activos ahora</h3>
                                </div>
                                <span className="text-xs font-bold text-[#a3ff12] light:text-[#96ab79]">Ver {activeNowList.length} →</span>
                              </div>
                              <div className="space-y-2">
                                {activeNowList.map(({ spot, riderCount }) => {
                                  const distanceKm = getDistanceKm(feedOrigin.lat, feedOrigin.lng, spot.lat, spot.lng);
                                  return (
                                    <button
                                      key={spot.id}
                                      onClick={() => openSpot(spot)}
                                      className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-800 rounded-2xl active:scale-[0.98] transition-all text-left light:bg-white light:border-black"
                                    >
                                      <img
                                        src={spot.image_url || PLACEHOLDER_IMAGE}
                                        alt={spot.name}
                                        className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-900"
                                        referrerPolicy="no-referrer"
                                        onError={handleImageError}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-white text-sm leading-tight truncate light:text-black">{spot.name}</h4>
                                        <p className="text-xs mt-0.5">
                                          <span className="text-[#a3ff12] font-semibold light:text-[#96ab79]">{formatDistance(distanceKm)}</span>
                                          {' · '}
                                          <span className="text-slate-500 uppercase font-mono light:text-slate-600">{parseCategories(spot.category)}</span>
                                        </p>
                                      </div>
                                      <div className="flex items-center -space-x-2 shrink-0">
                                        <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 light:border-white light:bg-slate-300" />
                                        <div className="w-6 h-6 rounded-full bg-slate-600 border-2 border-slate-900 light:border-white light:bg-slate-400" />
                                        <div className="w-6 h-6 rounded-full bg-[#a3ff12] border-2 border-slate-900 flex items-center justify-center text-black text-[9px] font-bold light:bg-[#96ab79] light:text-white light:border-white">
                                          +{riderCount}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Featured spot - MOCK pick (MOCK_FEATURED_SPOT_ID), nearby event is real */}
                          {featuredSpot && (
                            <button
                              onClick={() => openSpot(featuredSpot)}
                              className="relative w-full rounded-3xl overflow-hidden text-left active:scale-[0.98] transition-all"
                            >
                              <img
                                src={featuredSpot.image_url || PLACEHOLDER_IMAGE}
                                alt={featuredSpot.name}
                                className="w-full aspect-[4/5] object-cover bg-slate-900"
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />
                              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pr-14">
                                <span className="bg-[#a3ff12] text-black text-[10px] font-bold uppercase px-2.5 py-1 rounded-full light:bg-[#96ab79] light:text-white">
                                  Top de la semana
                                </span>
                                {featuredEvent && (
                                  <span className="bg-[#ff7a1a] text-black text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1 light:bg-black light:text-white">
                                    <Calendar className="w-3 h-3" />
                                    {featuredEvent.title} · {new Date(featuredEvent.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                              <span className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-md rounded-xl text-white light:bg-white light:text-black light:border light:border-black">
                                <Bookmark className="w-4 h-4" />
                              </span>
                              <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
                                <h3 className="text-2xl font-bold text-white leading-tight">{featuredSpot.name}</h3>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90 flex-wrap">
                                  {featuredSpot.review_count ? (
                                    <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-[#a3ff12] fill-[#a3ff12]" /> {featuredSpot.rating!.toFixed(1)}</span>
                                  ) : null}
                                  {featuredSpot.review_count ? <span>·</span> : null}
                                  <span>{formatDistance(getDistanceKm(feedOrigin.lat, feedOrigin.lng, featuredSpot.lat, featuredSpot.lng))}</span>
                                  {featuredSpot.features?.includes('Lights') && (
                                    <>
                                      <span>·</span>
                                      <span>Iluminado</span>
                                    </>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest">subido por {MOCK_FEATURED_UPLOADER}</p>
                              </div>
                            </button>
                          )}

                          {/* Nuevos spots - horizontal carousel for the 4 regional spots
                              that just got real photos, so they get visibility instead
                              of sitting buried inside the collapsed Chile folder below. */}
                          {newSpotsCarousel.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                                <h3 className="text-lg font-semibold text-white light:text-black">Nuevos spots</h3>
                              </div>
                              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1">
                                {newSpotsCarousel.map(spot => (
                                  <button
                                    key={spot.id}
                                    onClick={() => openSpot(spot)}
                                    className="w-36 shrink-0 snap-start text-left active:scale-[0.98] transition-all"
                                  >
                                    <img
                                      src={spot.image_url || PLACEHOLDER_IMAGE}
                                      alt={spot.name}
                                      className="w-36 h-44 rounded-2xl object-cover bg-slate-900"
                                      referrerPolicy="no-referrer"
                                      onError={handleImageError}
                                    />
                                    <h4 className="mt-1.5 font-semibold text-white text-sm leading-tight truncate light:text-black">{spot.name}</h4>
                                    <p className="text-xs text-slate-500 truncate light:text-slate-600">{spot.location_name}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Explorar por país - the rest of the spots (mostly far-off
                              regional ones) used to spill into one long flat grid here,
                              which made the feed feel endless. Grouped under a collapsed
                              "Chile" folder instead (real count, real grid inside), plus
                              placeholder folders for future LATAM regions with no spots
                              yet - see FUTURE_COUNTRY_FOLDERS in constants.tsx. */}
                          {restOfGrid.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-white light:text-black">Explorar por país</h3>

                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => setShowChileSpots(v => !v)}
                                  className="w-full flex items-center gap-2 p-4 bg-[#a3ff12] border border-[#a3ff12] rounded-2xl active:scale-[0.98] transition-all light:bg-[#96ab79] light:border-[#96ab79]"
                                >
                                  <span className="text-2xl shrink-0">🇨🇱</span>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className="font-semibold text-black text-sm light:text-white">Chile</p>
                                    <p className="text-xs text-black/70 font-semibold light:text-white/80">{restOfGrid.length} spots</p>
                                  </div>
                                  <ChevronRight className={cn("w-4 h-4 text-black/70 transition-transform shrink-0 light:text-white/80", showChileSpots && "rotate-90")} />
                                </button>

                                {FUTURE_COUNTRY_FOLDERS.map(country => (
                                  <div
                                    key={country.code}
                                    className="w-full flex items-center gap-2 p-4 bg-slate-800/20 border border-slate-800/60 rounded-2xl opacity-60 light:bg-slate-50 light:border-slate-300"
                                  >
                                    <span className="text-2xl shrink-0 grayscale">{country.flag}</span>
                                    <div className="flex-1 text-left min-w-0">
                                      <p className="font-semibold text-slate-400 text-sm light:text-slate-500">{country.name}</p>
                                      <p className="text-xs text-slate-600 light:text-slate-400">Próximamente</p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <AnimatePresence initial={false}>
                                {showChileSpots && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                  >
                                    {/* Filtro por región - evita el scroll eterno de antes: sin
                                        selección, la lista se agrupa en secciones por región; con
                                        una región elegida, se muestra solo esa (grid plano). */}
                                    {chileRegions.length > 1 && (() => {
                                      // Dos filas (cada una con su propio scroll horizontal) en vez
                                      // de una sola tira larga - "Todas" ancla la primera fila, el
                                      // resto de regiones se reparte alternado entre ambas.
                                      const row1 = chileRegions.filter((_, i) => i % 2 === 0);
                                      const row2 = chileRegions.filter((_, i) => i % 2 === 1);
                                      const chip = (label: string, active: boolean, onClick: () => void) => (
                                        <button
                                          key={label}
                                          onClick={onClick}
                                          className={cn(
                                            "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all",
                                            active
                                              ? "bg-[#a3ff12] text-black border-[#a3ff12] light:bg-[#96ab79] light:border-[#96ab79] light:text-white"
                                              : "bg-slate-800/50 text-slate-300 border-slate-700 light:bg-white light:text-black light:border-black"
                                          )}
                                        >
                                          {label}
                                        </button>
                                      );
                                      return (
                                        <div className="space-y-1.5 pt-2 pb-1">
                                          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                                            {chip('Todas', !chileRegionFilter, () => setChileRegionFilter(null))}
                                            {row1.map(region => chip(region, chileRegionFilter === region, () => setChileRegionFilter(v => v === region ? null : region)))}
                                          </div>
                                          {row2.length > 0 && (
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                                              {row2.map(region => chip(region, chileRegionFilter === region, () => setChileRegionFilter(v => v === region ? null : region)))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {chileRegionFilter ? (
                                      <div className="grid grid-cols-3 grid-flow-dense gap-3 pt-2">
                                        {chileGridItems.map(({ spot, distanceKm }, i) => renderChileSpotCard(spot, distanceKm, i % 4 === 0))}
                                      </div>
                                    ) : (
                                      <div className="space-y-4 pt-2">
                                        {chileGroupedItems.map(([region, items]) => (
                                          <div key={region} className="space-y-2">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest light:text-slate-600">{region} · {items.length}</p>
                                            <div className="grid grid-cols-3 grid-flow-dense gap-3">
                                              {items.map(({ spot, distanceKm }, i) => renderChileSpotCard(spot, distanceKm, i % 4 === 0))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Destacado - carrusel de ancho completo, mismo patrón visual
                              que el "Destacado" de Eventos: swipeable, flechas, paginación
                              en puntos. Muestra los spots con foto mejor valorados
                              (dato real, top 10 - no un pick fijo). */}
                          {destacadosCarousel.length > 0 && (
                            <div className="space-y-2">
                              <div className="relative -mx-6">
                                <div
                                  ref={spotsHeroScrollRef}
                                  onScroll={e => {
                                    const el = e.currentTarget;
                                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                                    if (idx !== spotsHeroIndex) setSpotsHeroIndex(idx);
                                  }}
                                  className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                                >
                                  {destacadosCarousel.map(({ spot, distanceKm }, i) => (
                                    <button
                                      key={spot.id}
                                      onClick={() => openSpot(spot)}
                                      className="w-full shrink-0 snap-start text-left"
                                    >
                                      <div className="relative overflow-hidden aspect-[16/10] bg-slate-900">
                                        <img
                                          src={spot.image_url || PLACEHOLDER_IMAGE}
                                          alt={spot.name}
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                          onError={handleImageError}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />
                                        <div className="absolute top-3 left-6 flex items-center gap-1.5">
                                          <span className="w-1 h-3.5 bg-[#a3ff12] rounded-full light:bg-[#96ab79]" />
                                          <span className="text-[10px] font-bold text-[#a3ff12] uppercase tracking-widest light:text-[#96ab79]">Destacado</span>
                                        </div>
                                        <span className="absolute top-3 right-6 text-[10px] font-bold text-white/80 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                                          {i + 1} / {destacadosCarousel.length}
                                        </span>
                                        <div className="absolute bottom-4 left-6 right-6 space-y-1.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {spot.review_count ? (
                                              <span className="flex items-center gap-1 text-[10px] font-mono text-black bg-[#a3ff12] uppercase tracking-widest px-2 py-0.5 rounded-md">
                                                <Star className="w-3 h-3 fill-black" /> {spot.rating!.toFixed(1)}
                                              </span>
                                            ) : null}
                                            <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/15 backdrop-blur px-2 py-0.5 rounded-md">
                                              {parseCategories(spot.category)}
                                            </span>
                                          </div>
                                          <h3 className="text-2xl font-bold text-white leading-tight">{spot.name}</h3>
                                          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{spot.location_name || formatDistance(distanceKm)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                {destacadosCarousel.length > 1 && (
                                  <>
                                    <button
                                      onClick={() => scrollCarouselBy(spotsHeroScrollRef, -1, 1)}
                                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all"
                                    >
                                      <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => scrollCarouselBy(spotsHeroScrollRef, 1, 1)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
                                  </>
                                )}
                              </div>
                              {destacadosCarousel.length > 1 && (
                                <div className="flex items-center justify-center gap-1.5">
                                  {destacadosCarousel.map((_, i) => (
                                    <span
                                      key={i}
                                      className={cn("h-1.5 rounded-full transition-all", i === spotsHeroIndex ? "w-4 bg-[#a3ff12] light:bg-[#96ab79]" : "w-1.5 bg-slate-700 light:bg-slate-300")}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sin foto aún - real count */}
                          {noPhotoSpots.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white light:text-black">Sin foto aún</h3>
                                <span className="text-xs text-slate-500 font-semibold light:text-slate-600">{noPhotoSpots.length} spots</span>
                              </div>
                              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5 space-y-2 light:bg-white light:border-black">
                                <p className="font-semibold text-white text-sm light:text-black">Sé el primero en fotografiarlos</p>
                                <p className="text-xs text-slate-400 light:text-slate-600">Los spots con foto reciben 4× más visitas.</p>
                                <button
                                  onClick={() => openSpot(noPhotoSpots[0].spot)}
                                  className="w-full bg-[#a3ff12] text-black font-bold text-xs uppercase tracking-widest py-3 rounded-xl mt-2 light:bg-[#96ab79] light:text-white"
                                >
                                  Ver los {noPhotoSpots.length} →
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : activeTab === 'events' ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold light:text-black">Eventos</h2>
                          <p className="text-xs text-slate-500 font-semibold light:text-slate-600">{filteredEvents.length} eventos programados</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setEventsSearchOpen(v => !v)}
                            className={cn("w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95", eventsSearchOpen ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800/50 border-slate-800 text-white light:bg-white light:border-black light:text-[#96ab79]")}
                          >
                            <Search className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEventsFilterOpen(v => !v)}
                            className={cn("relative w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95", (eventsFilterOpen || eventsCategoryFilter || eventsAvailableOnly) ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800/50 border-slate-800 text-white light:bg-white light:border-black light:text-[#96ab79]")}
                          >
                            <Filter className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {eventsSearchOpen && (
                        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-800 rounded-full px-4 h-11 light:bg-white light:border-black">
                          <Search className="w-4 h-4 text-slate-400 shrink-0 light:text-black" />
                          <input
                            autoFocus
                            value={eventsSearchQuery}
                            onChange={e => setEventsSearchQuery(e.target.value)}
                            placeholder="Buscar evento o lugar"
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none min-w-0 light:text-black light:placeholder:text-slate-500"
                          />
                        </div>
                      )}

                      {eventsFilterOpen && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                          <button
                            onClick={() => setEventsAvailableOnly(v => !v)}
                            className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all", eventsAvailableOnly ? "bg-[#a3ff12] text-black border-[#a3ff12] light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800/50 text-slate-300 border-slate-700 light:bg-white light:text-black light:border-black")}
                          >
                            Solo disponibles
                          </button>
                        </div>
                      )}

                      {/* Category tabs - mismo estilo grande/condensado que
                          la pestaña Spots (fuente Anton vía font-display),
                          en vez de los chips pequeños que tenía antes. */}
                      {eventCategories.length > 0 && (
                        <div className="flex gap-6 overflow-x-auto no-scrollbar items-end pb-0.5">
                          {([{ id: null as string | null, name: 'Todos', count: events.length }, ...eventCategories.map(cat => ({ id: cat, name: eventCategoryLabel(cat), count: events.filter(e => e.category === cat).length }))]).map(tab => {
                            const active = eventsCategoryFilter === tab.id;
                            return (
                              <button
                                key={tab.id ?? 'all'}
                                onClick={() => setEventsCategoryFilter(tab.id)}
                                className="shrink-0 flex flex-col items-start"
                              >
                                <span className={cn(
                                  "text-[10px] font-mono uppercase tracking-widest",
                                  active ? "text-[#ff7a1a] light:text-[#d97e3f]" : "text-slate-600 light:text-slate-400"
                                )}>
                                  {active ? `${tab.count} eventos` : tab.count}
                                </span>
                                <span className={cn(
                                  "font-display text-3xl uppercase tracking-tight leading-none transition-colors",
                                  active ? "text-[#ff7a1a] light:text-[#d97e3f]" : "text-[#ff7a1a]/20 light:text-[#d97e3f]/25"
                                )}>
                                  {tab.name}
                                </span>
                                <div className={cn("h-1 w-full rounded-full mt-2", active ? "bg-[#ff7a1a] light:bg-[#d97e3f]" : "bg-transparent")} />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Destacado - swipeable, recorre TODOS los eventos filtrados
                          (no solo uno fijo) para darles visibilidad a todos por turnos. */}
                      {filteredEvents.length > 0 && (
                        <div className="space-y-2">
                          <div className="relative -mx-6">
                            <div
                              ref={heroScrollRef}
                              onScroll={e => {
                                const el = e.currentTarget;
                                const idx = Math.round(el.scrollLeft / el.clientWidth);
                                if (idx !== heroEventIndex) setHeroEventIndex(idx);
                              }}
                              className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                            >
                              {filteredEvents.map((event, i) => (
                                <button
                                  key={event.id}
                                  onClick={() => openEventFromList(event)}
                                  className="w-full shrink-0 snap-start text-left"
                                >
                                  <div className="relative overflow-hidden aspect-[16/10] bg-slate-900">
                                    <img
                                      src={event.image_url || PLACEHOLDER_IMAGE}
                                      alt={event.title}
                                      className={cn("w-full h-full object-cover", event.available === false && "grayscale opacity-70")}
                                      referrerPolicy="no-referrer"
                                      onError={handleImageError}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />
                                    <div className="absolute top-3 left-6 flex items-center gap-1.5">
                                      <span className="w-1 h-3.5 bg-[#a3ff12] rounded-full light:bg-[#96ab79]" />
                                      <span className="text-[10px] font-bold text-[#a3ff12] uppercase tracking-widest light:text-[#96ab79]">Destacado</span>
                                    </div>
                                    <span className="absolute top-3 right-6 text-[10px] font-bold text-white/80 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                                      {i + 1} / {filteredEvents.length}
                                    </span>
                                    <div className="absolute bottom-4 left-6 right-6 space-y-1.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] font-mono text-black bg-[#ff7a1a] uppercase tracking-widest px-2 py-0.5 rounded-md light:bg-[#d97e3f]">
                                          {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                        </span>
                                        {event.available === false && (
                                          <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/15 backdrop-blur px-2 py-0.5 rounded-md">
                                            No disponible
                                          </span>
                                        )}
                                      </div>
                                      <h3 className="text-2xl font-bold text-white leading-tight">{event.title}</h3>
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{event.location_name}</span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                            {filteredEvents.length > 1 && (
                              <>
                                <button
                                  onClick={() => scrollCarouselBy(heroScrollRef, -1, 1)}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => scrollCarouselBy(heroScrollRef, 1, 1)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </>
                            )}
                          </div>
                          {filteredEvents.length > 1 && (
                            <div className="flex items-center justify-center gap-1.5">
                              {filteredEvents.map((_, i) => (
                                <span
                                  key={i}
                                  className={cn("h-1.5 rounded-full transition-all", i === heroEventIndex ? "w-4 bg-[#a3ff12] light:bg-[#96ab79]" : "w-1.5 bg-slate-700 light:bg-slate-300")}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Próximos eventos - solo los disponibles (fecha real y confirmada) */}
                      {upcomingEvents.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest light:text-black">Próximos eventos</h3>
                            <button onClick={() => setEventsAvailableOnly(true)} className="text-xs font-semibold text-[#a3ff12] light:text-[#96ab79]">Ver calendario →</button>
                          </div>
                          <div className="relative">
                            <div ref={upcomingScrollRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1">
                              {upcomingEvents.map(event => (
                                <button
                                  key={event.id}
                                  onClick={() => openEventFromList(event)}
                                  className="w-40 shrink-0 snap-start text-left active:scale-[0.98] transition-all"
                                >
                                  <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-900">
                                    <img
                                      src={event.image_url || PLACEHOLDER_IMAGE}
                                      alt={event.title}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                      onError={handleImageError}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                                    <span className="absolute top-2 left-2 text-[9px] font-mono text-black bg-[#ff7a1a] uppercase tracking-widest px-1.5 py-0.5 rounded-md light:bg-[#d97e3f]">
                                      {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                                      <h4 className="font-semibold text-white text-sm leading-tight line-clamp-2">{event.title}</h4>
                                      <p className="text-[10px] text-white/70 truncate mt-0.5">{event.location_name}</p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                            {upcomingEvents.length > 2 && (
                              <>
                                <button
                                  onClick={() => scrollCarouselBy(upcomingScrollRef, -1)}
                                  className="absolute left-1 top-20 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all light:hidden"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => scrollCarouselBy(upcomingScrollRef, 1)}
                                  className="absolute right-1 top-20 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-all light:hidden"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Todos los eventos - grilla de 3 columnas con grid-flow-dense;
                          algunas tarjetas ocupan 2 columnas y otras 1, para que no se
                          sienta como una lista repetitiva. */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest light:text-black">Todos los eventos</h3>
                        {filteredEvents.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-8 light:text-slate-600">Sin eventos para «{eventsSearchQuery}».</p>
                        ) : (
                          <div className="grid grid-cols-3 grid-flow-dense gap-2">
                            {(showAllEventsGrid ? filteredEvents : filteredEvents.slice(0, EVENTS_GRID_COLLAPSED_COUNT)).map((event, i) => {
                              const isWide = i % 4 === 0;
                              return (
                                <button
                                  key={event.id}
                                  onClick={() => openEventFromList(event)}
                                  className={cn("block text-left active:scale-[0.98] transition-all", isWide ? "col-span-2" : "col-span-1")}
                                >
                                  <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-900">
                                    <img
                                      src={event.image_url || PLACEHOLDER_IMAGE}
                                      alt={event.title}
                                      className={cn("w-full h-full object-cover", event.available === false && "grayscale opacity-60")}
                                      referrerPolicy="no-referrer"
                                      onError={handleImageError}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                                    <span className="absolute top-1.5 left-1.5 text-[8px] font-mono text-black bg-[#ff7a1a] uppercase tracking-widest px-1.5 py-0.5 rounded-md light:bg-[#d97e3f]">
                                      {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                    {event.available === false && (
                                      <span className="absolute top-1.5 right-1.5 text-[8px] font-bold text-white uppercase tracking-widest bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md">
                                        No disp.
                                      </span>
                                    )}
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                                      <h4 className={cn("font-semibold text-white leading-tight line-clamp-2", isWide ? "text-sm" : "text-[11px]")}>{event.title}</h4>
                                      <p className="text-[9px] text-white/70 truncate mt-0.5 flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 shrink-0" /> {event.location_name}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {!showAllEventsGrid && filteredEvents.length > EVENTS_GRID_COLLAPSED_COUNT && (
                          <button
                            onClick={() => setShowAllEventsGrid(true)}
                            className="w-full bg-slate-800/50 border border-slate-800 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-2xl active:scale-[0.98] transition-all light:bg-white light:border-black light:text-black"
                          >
                            Ver todos ({filteredEvents.length})
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeTab === 'admin' ? (
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold">Cola de Revisión</h2>
                      {pendingVideos.map(video => (
                        <div key={video.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                          <video src={video.video_url} className="w-full rounded-xl mb-3" controls />
                          <p className="text-sm font-semibold">{video.spot_name}</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => handleApprove(video.id)} className="flex-1 bg-emerald-500 text-slate-950 py-2 rounded-lg font-semibold text-sm">Aprobar</button>
                            <button onClick={() => handleReject(video.id)} className="flex-1 bg-rose-500/10 text-rose-500 py-2 rounded-lg font-semibold text-sm border border-rose-500/20">Rechazar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === 'community' ? (
                    <div className="bg-[#0a0f02] min-h-screen -mx-6 -mt-6 pb-20 overflow-y-auto no-scrollbar light:bg-white">
                      <div className="flex items-center justify-between px-6 py-6 sticky top-0 bg-[#0a0f02]/90 backdrop-blur-xl z-50 border-b border-white/5 light:bg-white light:border-black">
                        <div className="flex items-center gap-3">
                          <Wordmark iconSize="md" textClassName="text-2xl" lightClassName="h-7" />
                        </div>
                        <div className="flex items-center gap-3">
                          {user ? (
                            <>
                              <button
                                onClick={() => { if (window.confirm('¿Quieres cerrar sesión?')) handleSignOut(); }}
                                className="p-1 bg-white/5 rounded-full border border-white/10 active:scale-95 transition-all light:bg-white light:border-black"
                              >
                                <img
                                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                                  className="w-8 h-8 rounded-full"
                                  alt="Profile"
                                />
                              </button>
                              <button
                                onClick={() => { setActiveTab('profile'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); }}
                                className="p-2.5 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all light:bg-white light:border-black"
                                title="Perfil"
                              >
                                <User className="w-5 h-5 text-white light:text-black" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setIsGuest(false)}
                              className="px-4 py-2.5 bg-[#a3ff12] text-black rounded-2xl font-bold text-xs active:scale-95 transition-all light:bg-[#96ab79] light:text-white"
                            >
                              Iniciar sesión
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="px-6 py-6 border-b border-white/5 light:border-black">
                        <StoriesRow posts={posts} onOpen={handleOpenPost} onCreate={() => setIsCreatingPost(true)} />
                      </div>

                      <div className="px-6 py-8">
                        {posts.length === 0 ? (
                          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center light:bg-white light:border-black">
                            <Camera className="w-12 h-12 text-slate-800 mx-auto mb-4 light:text-slate-300" />
                            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">El feed está vacío</p>
                            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en compartir un clip o una foto</p>
                            <button
                              onClick={() => setIsCreatingPost(true)}
                              className="mt-5 bg-[#a3ff12] text-black px-5 py-2.5 rounded-full text-xs font-bold active:scale-95 transition-all light:bg-[#96ab79] light:text-white"
                            >
                              PUBLICAR ALGO
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-10">
                            {posts.map(post => (
                              <PostCard
                                key={post.id}
                                post={post}
                                onToggleLike={handleToggleLike}
                                onOpen={handleOpenPost}
                                onOpenAuthor={handleOpenPublicProfile}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeTab === 'profile' ? (
                    <div className="space-y-3">
                      {/* Portada + avatar superpuesto - myProfile.bannerURL con
                          BANNER_OPTIONS[0] como respaldo visual (igual que el
                          avatar dicebear más abajo: solo vista previa hasta que
                          el usuario elige/guarda uno propio en EditProfileForm).
                          Configuración/Notificaciones flotan sobre la portada en
                          vez de vivir en una fila de título aparte. */}
                      <div className="relative -mx-6 -mt-6">
                        <div className="relative aspect-[2.2/1] overflow-hidden bg-slate-900 light:bg-white">
                          <img
                            src={myProfile?.bannerURL || BANNER_OPTIONS[0] || PLACEHOLDER_IMAGE}
                            alt="Portada de perfil"
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

                          {/* Drag handle - puramente decorativo aquí (el
                              motion.div del sheet ya tiene drag="y" sin
                              importar esto), reemplaza el texto "Desliza
                              para minimizar" que vivía en una barra sólida
                              aparte antes de que el banner llegara al borde.
                              top-7 y el fondo con blur evitan que quede
                              recortada por la esquina redondeada del panel
                              o se pierda contra fotos claras. */}
                          <div
                            className="absolute top-7 inset-x-0 flex justify-center cursor-grab active:cursor-grabbing"
                            onClick={() => isOverlayMinimized && setIsOverlayMinimized(false)}
                          >
                            <div className="w-12 h-1.5 bg-white/70 backdrop-blur-md rounded-full shadow-sm" />
                          </div>

                          <div className="absolute top-8 right-4 flex flex-col gap-2">
                            <button
                              onClick={() => setShowSettings(true)}
                              className="p-2.5 bg-black/40 backdrop-blur-md rounded-full active:scale-90 transition-transform light:bg-white/90 light:border light:border-black"
                              title="Configuración"
                            >
                              <SettingsIcon className="w-5 h-5 text-white light:text-black" />
                            </button>
                            <button
                              onClick={() => setShowNotifications(true)}
                              className="relative p-2.5 bg-black/40 backdrop-blur-md rounded-full active:scale-90 transition-transform light:bg-white/90 light:border light:border-black"
                              title="Notificaciones"
                            >
                              <Bell className="w-5 h-5 text-white light:text-black" />
                              {notifications.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#a3ff12] text-black text-[9px] font-bold flex items-center justify-center light:bg-[#96ab79] light:text-white">
                                  {notifications.length > 9 ? '9+' : notifications.length}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="absolute -bottom-8 left-6">
                          {(myProfile?.photoURL || user?.photoURL) ? (
                            <img
                              src={myProfile?.photoURL || user?.photoURL || undefined}
                              className="w-20 h-20 rounded-full border-4 border-slate-900 object-cover light:border-white"
                              alt="Profile"
                            />
                          ) : user ? (
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                              className="w-20 h-20 rounded-full border-4 border-slate-900 light:border-white"
                              alt="Profile"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-slate-400 shrink-0 light:bg-white light:border-white light:text-black">
                              <User className="w-9 h-9" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nombre - pl-6 alineado con el left-6 del avatar de
                          arriba; pt-5 (+ space-y-3 del padre) despeja los
                          32px que el avatar superpone sobre la portada. */}
                      <div className="pl-6 pt-5 min-w-0">
                        <p className="font-bold text-white text-lg truncate light:text-black">{myProfile?.displayName || user?.displayName || (user ? 'Rider' : 'Invitado')}</p>
                        {user?.email && <p className="text-xs text-slate-500 truncate light:text-slate-600">{user.email}</p>}
                        {myProfile?.instagram && (
                          <a
                            href={`https://instagram.com/${myProfile.instagram}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#a3ff12] mt-1 light:text-[#96ab79]"
                          >
                            <InstagramIcon className="w-3.5 h-3.5" /> @{myProfile.instagram}
                          </a>
                        )}
                      </div>

                      {/* Stats reales, ver GET /api/users/me/challenges (stats) y myProfile.favorites */}
                      <div className="grid grid-cols-3 bg-slate-800/50 border border-slate-800 rounded-2xl py-3 light:bg-white light:border-black">
                        <div className="text-center border-r border-slate-800 light:border-black">
                          <p className="text-xl font-bold text-white light:text-black">{myChallenges?.stats.spotsVisited ?? 0}</p>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Spots visitados</p>
                        </div>
                        <div className="text-center border-r border-slate-800 light:border-black">
                          <p className="text-xl font-bold text-white light:text-black">{myChallenges?.stats.reviewsWritten ?? 0}</p>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Reseñas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-white light:text-black">{(myProfile?.favorites ?? []).length}</p>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Favoritos</p>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="flex items-center border-b border-slate-800 light:border-black">
                        {([
                          { id: 'challenges', label: 'Desafíos' },
                          { id: 'favorites', label: 'Favoritos' },
                          { id: 'activity', label: 'Actividad' },
                          { id: 'myspots', label: 'Mis spots' },
                        ] as const).map(t => (
                          <button
                            key={t.id}
                            onClick={() => setProfileTab(t.id)}
                            className={cn(
                              "flex-1 min-w-0 truncate px-1 pb-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px text-center",
                              profileTab === t.id ? "text-[#a3ff12] border-[#a3ff12] light:text-[#96ab79] light:border-[#96ab79]" : "text-slate-500 border-transparent light:text-slate-500"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Tab content - desafíos/favoritos reales, ver GET /api/users/me/challenges y myProfile.favorites en App.tsx */}
                      {profileTab === 'challenges' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-6 border-b border-slate-800/60 light:border-black/30">
                            {([
                              { id: 'active', label: 'Activos' },
                              { id: 'completed', label: 'Completados' },
                            ] as const).map(t => (
                              <button
                                key={t.id}
                                onClick={() => setChallengesSubTab(t.id)}
                                className={cn(
                                  "pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px",
                                  challengesSubTab === t.id ? "text-[#a3ff12] border-[#a3ff12] light:text-[#96ab79] light:border-[#96ab79]" : "text-slate-500 border-transparent light:text-slate-500"
                                )}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {(myChallenges?.challenges ?? []).filter(c => challengesSubTab === 'active' ? !c.completed : c.completed).map(c => {
                              const Icon = CHALLENGE_ICONS[c.id] ?? Trophy;
                              const pct = Math.min(100, Math.round((c.progress / c.goal) * 100));
                              const isFeatured = c.id === FEATURED_CHALLENGE_ID;
                              return (
                                <div
                                  key={c.id}
                                  className={cn(
                                    "rounded-2xl p-3 border overflow-hidden",
                                    isFeatured
                                      ? "col-span-2 bg-[#a3ff12] border-[#a3ff12] shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:border-[#96ab79] light:shadow-none"
                                      : "bg-slate-800/50 border-slate-800 light:bg-white light:border-black"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      {isFeatured && (
                                        <span className="inline-block text-[8px] font-bold text-black uppercase tracking-widest bg-black/15 px-1.5 py-0.5 rounded-md mb-1 light:text-white light:bg-white/20">
                                          Destacado
                                        </span>
                                      )}
                                      <h3 className={cn("font-semibold text-sm leading-snug line-clamp-2", isFeatured ? "text-black light:text-white" : "text-white light:text-black")}>{c.title}</h3>
                                      <p className={cn("text-xs mt-1 line-clamp-2", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-400 light:text-slate-600")}>{c.description}</p>
                                    </div>
                                    <div className={cn(
                                      "shrink-0 w-9 h-9 rounded-full flex items-center justify-center border",
                                      isFeatured ? "bg-black/15 border-black/10 light:bg-white/20 light:border-white/20" : "bg-slate-900 border-slate-700 light:bg-white light:border-black"
                                    )}>
                                      <Icon className={cn("w-4 h-4", isFeatured ? "text-black light:text-white" : "text-[#a3ff12] light:text-[#96ab79]")} />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end mt-3">
                                    <span className={cn("text-xs font-semibold", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-400 light:text-slate-600")}>{c.progress}/{c.goal}</span>
                                  </div>
                                  <div className={cn("w-full h-1.5 rounded-full overflow-hidden mt-1.5", isFeatured ? "bg-black/15 light:bg-white/20" : "bg-slate-900 light:bg-slate-200")}>
                                    <div
                                      className={cn("h-full rounded-full", isFeatured ? "bg-black light:bg-white" : "bg-[#a3ff12] shadow-[0_0_8px_#a3ff12] light:bg-[#96ab79] light:shadow-none")}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between mt-3 gap-1">
                                    <span className={cn("min-w-0 truncate text-[9px] font-semibold uppercase tracking-widest", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-500 light:text-slate-600")}>Recompensa</span>
                                    <span className={cn("flex items-center gap-1 text-xs font-bold shrink-0", isFeatured ? "text-black light:text-white" : "text-[#a3ff12] light:text-[#96ab79]")}>
                                      <Trophy className="w-3.5 h-3.5" /> {c.xp} XP
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {profileTab === 'favorites' && (
                        (myProfile?.favorites ?? []).length === 0 ? (
                          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-10 text-center light:bg-white light:border-black">
                            <Heart className="w-10 h-10 text-slate-800 mx-auto mb-3 light:text-slate-300" />
                            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Sin favoritos todavía</p>
                            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Guarda spots tocando el corazón en su detalle</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            {(myProfile?.favorites ?? [])
                              .map(id => spots.find(s => s.id === id))
                              .filter((s): s is Spot => !!s)
                              .map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => { setSelectedSpot(f); setShowMobileOverlay(true); }}
                                  className="flex flex-col text-left bg-slate-800/50 border border-slate-800 rounded-2xl overflow-hidden light:bg-white"
                                >
                                  <img
                                    src={f.image_url || PLACEHOLDER_IMAGE}
                                    alt={f.name}
                                    className="w-full aspect-square object-cover bg-slate-900"
                                    referrerPolicy="no-referrer"
                                    onError={handleImageError}
                                  />
                                  <div className="p-2.5">
                                    <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 light:text-black">{f.name}</h3>
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star className="w-3 h-3 text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]" />
                                      <span className="text-xs font-semibold text-white light:text-black">{(f.rating ?? 0).toFixed(1)}</span>
                                    </div>
                                  </div>
                                </button>
                              ))}
                          </div>
                        )
                      )}

                      {profileTab === 'activity' && (
                        <ActivityList items={myActivity} onOpenSpot={openSpotById} />
                      )}

                      {profileTab === 'myspots' && (
                        <MySpotsList spots={mySpots} onOpenSpot={openSpotFromProfile} />
                      )}

                      <div className="space-y-2 pt-2">
                        {isAdmin && (
                          <button
                            onClick={() => setActiveTab('admin')}
                            className="w-full flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-2xl active:scale-[0.98] transition-all light:bg-white light:border-black"
                          >
                            <div className="p-2 bg-[#a3ff12]/10 rounded-xl light:bg-white light:border light:border-black">
                              <ShieldCheck className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                            </div>
                            <span className="flex-1 text-left font-semibold text-white light:text-black">Panel Admin</span>
                            <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Nav - flota sobre el mapa (fixed, no ocupa espacio en el
          flex-col) en vez de una barra sólida que empuja el mapa hacia
          arriba, así el mapa llega hasta el borde inferior real de la
          pantalla. Una sola píldora continua sin espacios entre íconos
          (solo íconos, sin etiqueta) - la pestaña activa se marca con un
          bloque redondeado de acento a todo el alto de la barra. El botón
          "+" vive fuera de esa píldora (overflow-hidden la recortaría):
          es su propio botón más grande, centrado encima del hueco del
          medio, así sobresale un poco por arriba y por abajo en vez de
          quedar a la misma altura que los demás. */}
      <div className="fixed bottom-8 inset-x-4 z-[3000]">
        <div className="flex items-stretch h-8 overflow-hidden rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-2xl light:bg-white light:border-transparent light:shadow-none">
          <button
            onClick={() => {
              if (activeTab === 'map' && !showMobileOverlay) return;
              setActiveTab('map'); setShowMobileOverlay(false); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setIsOverlayMinimized(false);
            }}
            className={cn(
              "flex-1 flex items-center justify-center transition-colors",
              activeTab === 'map' && !showMobileOverlay
                ? "rounded-[28px] bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                : "text-white/70 light:text-[#4a3728]"
            )}
          >
            <MapIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (activeTab === 'list' && showMobileOverlay) {
                setShowMobileOverlay(false); setActiveTab('map');
              } else {
                setActiveTab('list'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
              }
            }}
            className={cn(
              "flex-1 flex items-center justify-center transition-colors",
              activeTab === 'list' && showMobileOverlay
                ? "rounded-[28px] bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                : "text-white/70 light:text-[#4a3728]"
            )}
          >
            <ListIcon className="w-5 h-5" />
          </button>
          <div className="flex-1" aria-hidden="true" />
          <button
            onClick={() => {
              if (activeTab === 'events' && showMobileOverlay) {
                setShowMobileOverlay(false); setActiveTab('map');
              } else {
                setActiveTab('events'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
              }
            }}
            className={cn(
              "flex-1 flex items-center justify-center transition-colors",
              activeTab === 'events' && showMobileOverlay
                ? "rounded-[28px] bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                : "text-white/70 light:text-[#4a3728]"
            )}
          >
            <Calendar className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (activeTab === 'community' && showMobileOverlay) {
                setShowMobileOverlay(false); setActiveTab('map');
              } else {
                setActiveTab('community'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
              }
            }}
            className={cn(
              "flex-1 flex items-center justify-center transition-colors",
              activeTab === 'community' && showMobileOverlay
                ? "rounded-[28px] bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white"
                : "text-white/70 light:text-[#4a3728]"
            )}
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => {
            if (isAddingSpot && showMobileOverlay) {
              setIsAddingSpot(false); setShowMobileOverlay(false); setActiveTab('map');
            } else {
              setIsAddingSpot(true); setShowMobileOverlay(true); setActiveTab('map'); setSelectedSpot(null); setSelectedEvent(null);
            }
          }}
          className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-lg",
            isAddingSpot && showMobileOverlay ? "bg-white/10 text-[#a3ff12] light:bg-black light:text-white" : "bg-[#a3ff12] text-black light:bg-[#96ab79] light:text-white")}
          title="Agregar spot"
        >
          <Plus className={cn("w-6 h-6 transition-transform", isAddingSpot && showMobileOverlay ? "rotate-45" : "rotate-0")} />
        </button>
      </div>

      {/* Spot Filters - full-screen panel */}
      <AnimatePresence>
        {showSpotFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] bg-slate-950 flex flex-col light:bg-white"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 light:border-black">
              <button onClick={() => setShowSpotFilters(false)} className="p-2 -ml-2 text-white active:scale-90 transition-transform light:text-black">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-semibold text-white light:text-black">Filtros</h2>
              <button onClick={clearSpotFilters} className="text-sm font-semibold text-[#a3ff12] light:text-[#96ab79]">Limpiar</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white light:text-black">Tipo de spot</h3>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: 'street', label: 'Street', icon: Mountain },
                    { id: 'park', label: 'Park', icon: TriangleAlert },
                    { id: 'bowl', label: 'Bowl', icon: Soup },
                    { id: 'diy', label: 'DIY', icon: Atom },
                  ] as const).map(t => {
                    const Icon = t.icon;
                    const active = filterSpotType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setFilterSpotType(active ? null : t.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all",
                          active ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900 border-slate-800 text-slate-400 light:bg-white light:border-black light:text-black"
                        )}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-[11px] font-semibold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white light:text-black">Características</h3>
                <div className="flex flex-wrap gap-2">
                  {SPOT_FEATURES.map(f => {
                    const active = filterFeatures.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => setFilterFeatures(prev => active ? prev.filter(x => x !== f) : [...prev, f])}
                        className={cn(
                          "px-4 py-2.5 rounded-full border text-sm font-semibold transition-all",
                          active ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900 border-slate-800 text-slate-300 light:bg-white light:border-black light:text-black"
                        )}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white light:text-black">Nivel de dificultad</h3>
                <div className="flex gap-2">
                  {([
                    { id: 'principiante', label: 'Principiante' },
                    { id: 'intermedio', label: 'Intermedio' },
                    { id: 'avanzado', label: 'Avanzado' },
                  ] as const).map(d => {
                    const active = filterDifficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setFilterDifficulty(active ? null : d.id)}
                        className={cn(
                          "flex-1 py-2.5 rounded-full border text-xs font-semibold transition-all",
                          active ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900 border-slate-800 text-slate-300 light:bg-white light:border-black light:text-black"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white light:text-black">Calificación mínima</h3>
                <div className="flex gap-2">
                  {[3, 4, 4.5].map(r => {
                    const active = filterMinRating === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setFilterMinRating(active ? null : r)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border text-sm font-semibold transition-all",
                          active ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900 border-slate-800 text-slate-300 light:bg-white light:border-black light:text-black"
                        )}
                      >
                        <Star className="w-4 h-4" /> {r}+
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/5 light:border-black">
              <button
                onClick={() => setShowSpotFilters(false)}
                className="w-full bg-[#a3ff12] text-black font-bold py-4 rounded-2xl active:scale-[0.98] transition-all light:bg-[#96ab79] light:text-white"
              >
                Aplicar filtros
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings - full-screen panel. "Unidades" is real (see formatDistance
          above); the rest are local-only toggles/placeholders, see the note
          on the settings state declarations. */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] bg-slate-950 flex flex-col light:bg-white"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 light:border-black">
              <button
                onClick={() => {
                  if (showEditProfile) setShowEditProfile(false);
                  else if (settingsSubView) setSettingsSubView(null);
                  else setShowSettings(false);
                }}
                className="p-2 -ml-2 text-white active:scale-90 transition-transform light:text-black"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-semibold text-white light:text-black">
                {showEditProfile ? 'Editar perfil'
                  : settingsSubView === 'notifications' ? 'Notificaciones'
                  : settingsSubView === 'privacy' ? 'Privacidad'
                  : settingsSubView === 'help' ? 'Centro de ayuda'
                  : 'Configuración'}
              </h2>
              <div className="w-10" />
            </div>

            {showEditProfile ? (
              <div className="flex-1 overflow-y-auto p-5">
                <EditProfileForm user={user} profile={myProfile} onSave={handleUpdateProfile} />
              </div>
            ) : settingsSubView === 'notifications' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white light:text-black">Activadas</h3>
                    <ToggleSwitch on={notificationsEnabled} onToggle={() => setNotificationsEnabled(v => !v)} />
                  </div>
                  <p className="text-xs text-slate-400 light:text-slate-600">Con todo silenciado no llega ningún aviso, ni de eventos a los que vas.</p>
                </div>

                <div className={cn("space-y-2", !notificationsEnabled && "opacity-40 pointer-events-none")}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Qué avisar</h3>

                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <MapPin className="w-5 h-5 text-[#a3ff12] shrink-0 mt-0.5 light:text-[#96ab79]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Spots nuevos cerca</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">Cuando se publica un spot a menos de {notifRadiusKm} km de ti.</p>
                    </div>
                    <ToggleSwitch on={notifNewSpotsNearby} onToggle={() => setNotifNewSpotsNearby(v => !v)} />
                  </div>

                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <Calendar className="w-5 h-5 text-[#a3ff12] shrink-0 mt-0.5 light:text-[#96ab79]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Eventos y jams</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">Aviso el día antes de un evento al que te apuntaste.</p>
                    </div>
                    <ToggleSwitch on={notifEvents} onToggle={() => setNotifEvents(v => !v)} />
                  </div>

                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <Camera className="w-5 h-5 text-[#a3ff12] shrink-0 mt-0.5 light:text-[#96ab79]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Actividad en mis spots</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">Reseñas, fotos y clips en los spots que subiste.</p>
                    </div>
                    <ToggleSwitch on={notifMySpotsActivity} onToggle={() => setNotifMySpotsActivity(v => !v)} />
                  </div>

                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Estado de moderación</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">Cuando un spot tuyo se aprueba o se rechaza. Próximamente.</p>
                    </div>
                    <ToggleSwitch on={false} onToggle={() => {}} disabled />
                  </div>

                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <Moon className="w-5 h-5 text-[#a3ff12] shrink-0 mt-0.5 light:text-[#96ab79]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Horario silencioso</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">De 23:00 a 08:00 no suena nada.</p>
                    </div>
                    <ToggleSwitch on={notifQuietHours} onToggle={() => setNotifQuietHours(v => !v)} />
                  </div>

                  <button
                    onClick={() => setNotifRadiusKm(km => {
                      const i = NOTIF_RADIUS_OPTIONS_KM.indexOf(km);
                      return NOTIF_RADIUS_OPTIONS_KM[(i + 1) % NOTIF_RADIUS_OPTIONS_KM.length];
                    })}
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                  >
                    <span className="text-sm font-semibold text-white light:text-black">Radio de avisos</span>
                    <span className="text-sm font-bold text-[#a3ff12] light:text-[#96ab79]">{notifRadiusKm} km</span>
                  </button>
                </div>
              </div>
            ) : settingsSubView === 'privacy' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white light:text-black">Cuenta pública</h3>
                    <ToggleSwitch on={!privateAccount} onToggle={() => setPrivateAccount(v => !v)} />
                  </div>
                  <p className="text-xs text-slate-400 light:text-slate-600">Cualquiera puede ver tu perfil, los spots que subiste y tus clips. Es lo que hace que la comunidad encuentre spots nuevos.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Qué ve el resto ahora</h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 light:bg-white light:border-black light:divide-black">
                    {[
                      ['Perfil', privateAccount ? 'Privado' : 'Público'],
                      ['Mis spots', privateAccount ? 'Anónimo' : 'Con tu nombre'],
                      ['Clips y fotos', privateAccount ? 'Privados' : 'Públicos'],
                      ['Reseñas', privateAccount ? 'Públicas, anónimas' : 'Públicas, con nombre'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-slate-300 light:text-black">{label}</span>
                        <span className="text-sm font-bold text-white light:text-black">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 light:bg-white light:border-black">
                    <Locate className="w-5 h-5 text-[#a3ff12] shrink-0 mt-0.5 light:text-[#96ab79]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white light:text-black">Ubicación exacta en mis spots</p>
                      <p className="text-xs text-slate-500 light:text-slate-600">{exactLocationEnabled ? 'El pin muestra la ubicación exacta.' : 'Apagado, el pin se muestra desplazado 200 m.'}</p>
                    </div>
                    <ToggleSwitch on={exactLocationEnabled} onToggle={() => setExactLocationEnabled(v => !v)} />
                  </div>

                  <button
                    onClick={() => alert('Próximamente: gestionar riders bloqueados.')}
                    className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                  >
                    <Users className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                    <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Riders bloqueados</span>
                    <span className="text-xs text-slate-500 light:text-slate-600">0</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                  </button>

                  <button
                    onClick={() => alert('Próximamente: exportar tus datos.')}
                    className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                  >
                    <Download className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                    <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Descargar mis datos</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                  </button>
                </div>
              </div>
            ) : settingsSubView === 'help' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
                  <input
                    value={helpSearchQuery}
                    onChange={e => setHelpSearchQuery(e.target.value)}
                    placeholder="Buscar en la ayuda"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 light:bg-white light:border-black light:text-black"
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Preguntas frecuentes</h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 light:bg-white light:border-black light:divide-black overflow-hidden">
                    {filteredFaqs.length === 0 ? (
                      <p className="text-sm text-slate-500 p-4 light:text-slate-600">Sin resultados para «{helpSearchQuery}».</p>
                    ) : filteredFaqs.map(faq => {
                      const isOpen = openFaqId === faq.id;
                      return (
                        <div key={faq.id}>
                          <button
                            onClick={() => setOpenFaqId(v => v === faq.id ? null : faq.id)}
                            className="w-full flex items-center justify-between gap-3 p-4 text-left"
                          >
                            <span className="text-sm font-semibold text-white light:text-black">{faq.question}</span>
                            {isOpen ? (
                              <Minus className="w-4 h-4 text-[#a3ff12] shrink-0 light:text-[#96ab79]" />
                            ) : (
                              <Plus className="w-4 h-4 text-[#a3ff12] shrink-0 light:text-[#96ab79]" />
                            )}
                          </button>
                          {isOpen && (
                            <p className="px-4 pb-4 text-xs text-slate-400 leading-relaxed light:text-slate-600">{faq.answer}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">¿No está aquí?</h3>
                  <button
                    onClick={() => alert('Próximamente: escríbenos.')}
                    className="w-full flex items-center justify-center gap-2 bg-[#a3ff12] text-black font-bold text-sm py-3.5 rounded-2xl active:scale-[0.98] transition-all light:bg-[#96ab79] light:text-white"
                  >
                    <Mail className="w-4 h-4" /> Escríbenos
                  </button>
                  <button
                    onClick={() => alert('Próximamente: reportar un problema.')}
                    className="w-full flex items-center justify-center gap-2 border border-slate-700 text-white font-bold text-sm py-3.5 rounded-2xl active:scale-[0.98] transition-all light:border-black light:text-black"
                  >
                    <TriangleAlert className="w-4 h-4" /> Reportar un problema
                  </button>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button onClick={() => alert('Próximamente: términos de servicio.')} className="text-xs font-semibold text-slate-500 uppercase tracking-widest light:text-black">Términos</button>
                  <button onClick={() => alert('Próximamente: política de privacidad.')} className="text-xs font-semibold text-slate-500 uppercase tracking-widest light:text-black">Privacidad</button>
                </div>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Cuenta</h3>
                <button
                  onClick={() => setShowEditProfile(true)}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <User className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Editar perfil</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>

                {user ? (
                  <button
                    onClick={() => { if (window.confirm('¿Quieres cerrar sesión?')) { handleSignOut(); setShowSettings(false); } }}
                    className="w-full flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                  >
                    <LogOut className="w-5 h-5 text-rose-500 light:text-[#96ab79]" />
                    <span className="flex-1 text-left text-sm font-semibold text-rose-500 light:text-black">Cerrar sesión</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setIsGuest(false); setShowSettings(false); }}
                    className="w-full flex items-center gap-3 bg-[#a3ff12]/10 border border-[#a3ff12]/20 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                  >
                    <LogIn className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                    <span className="flex-1 text-left text-sm font-semibold text-[#a3ff12] light:text-black">Iniciar sesión</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Preferencias</h3>

                <button
                  onClick={() => setUnitsPreference(p => p === 'km' ? 'mi' : 'km')}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <Ruler className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Unidades</span>
                  <span className="text-xs text-slate-500 light:text-slate-600">{unitsPreference === 'mi' ? 'Millas (mi)' : 'Kilómetros (km)'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>

                <button
                  onClick={() => setMapTypePreference(p => p === 'oscuro' ? 'claro' : 'oscuro')}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <SettingsIcon className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Tema</span>
                  <div
                    className={cn("shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors", isLight ? "bg-[#a3ff12] light:bg-[#96ab79]" : "bg-slate-700 light:bg-black")}
                    role="switch"
                    aria-checked={isLight}
                  >
                    <div className={cn("w-5 h-5 rounded-full bg-white shadow-md transition-transform", isLight ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </button>

                <button
                  onClick={() => setSettingsSubView('notifications')}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <Bell className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Notificaciones</span>
                  <span className="text-xs text-slate-500 light:text-slate-600">{notificationsEnabled ? 'Activadas' : 'Silenciadas'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Privacidad</h3>
                <button
                  onClick={() => setSettingsSubView('privacy')}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <Shield className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Privacidad</span>
                  <span className="text-xs text-slate-500 light:text-slate-600">{privateAccount ? 'Cuenta privada' : 'Cuenta pública'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Ayuda</h3>
                <button
                  onClick={() => setSettingsSubView('help')}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-all light:bg-white light:border-black"
                >
                  <HelpCircle className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  <span className="flex-1 text-left text-sm font-semibold text-white light:text-black">Centro de ayuda</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>
              </div>
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ventanas nuevas: notificaciones, publicación, nueva publicación y
          perfil público. Van como hojas a pantalla completa por encima de
          todo, igual que Configuración. */}
      <AnimatePresence>
        {(showNotifications || openPost || isCreatingPost || publicProfile || isLoadingPublicProfile) && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[5500] bg-[#0a0f02] overflow-y-auto p-6 pt-[calc(env(safe-area-inset-top)+16px)] pb-24 light:bg-white"
          >
            {isCreatingPost ? (
              <PostComposer spots={spots} onSubmit={handleCreatePost} onClose={() => setIsCreatingPost(false)} />
            ) : openPost ? (
              <PostDetail
                post={posts.find(p => p.id === openPost.id) ?? openPost}
                comments={openPostComments}
                currentUid={user?.uid ?? null}
                onClose={closePost}
                onToggleLike={handleToggleLike}
                onAddComment={handleAddComment}
                onDelete={handleDeletePost}
                onOpenAuthor={handleOpenPublicProfile}
              />
            ) : publicProfile ? (
              <PublicProfileView
                profile={publicProfile}
                onClose={() => setPublicProfile(null)}
                onOpenSpot={(spot) => { setPublicProfile(null); closePost(); openSpotFromProfile(spot); }}
                onOpenPost={(post) => { setPublicProfile(null); handleOpenPost(post); }}
              />
            ) : isLoadingPublicProfile ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-[#a3ff12] border-t-transparent rounded-full animate-spin light:border-[#96ab79]" />
              </div>
            ) : (
              <NotificationsScreen
                items={notifications}
                onClose={() => setShowNotifications(false)}
                onOpenSpot={(spotId) => { setShowNotifications(false); openSpotById(spotId); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
