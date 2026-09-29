import React from 'react';
import { Map, Marker } from '@vis.gl/react-google-maps';
import {
  MapPin, Plus, ShieldCheck, X, Check, Compass, Calendar,
  Users, Locate, Bell, User, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Star,
  Settings as SettingsIcon, Ruler, Shield, HelpCircle, LogOut, LogIn, ChevronRight, Map as MapIcon,
  List as ListIcon, Trophy, ChevronLeft, Camera, Sparkles, Instagram as InstagramIcon, Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, PLACEHOLDER_IMAGE, handleImageError, getDistanceKm, getRelatedSpots, getNearbyEvents, getNearbySpots } from '../lib/utils';
import { Spot, UrbanEvent, VideoClip, SpotPhoto, SpotReview, EventPhoto, EventReview, FirebaseUser, UserProfile, ChallengesResponse, CommunityPost, PostComment, ActivityItem, AppNotification, PublicProfile } from '../types';
import {
  MAP_STYLES, MAP_STYLES_LIGHT,
  BANNER_OPTIONS,
} from '../constants';
import { PostCard, PostComposer, PostDetail, StoriesRow, PublicProfileView } from '../components/Community';
import { ActivityList, MySpotsList, NotificationsList } from '../components/ActivityFeed';
import { METRO_STATIONS } from '../data/metroStations';
import { SkaterLogo } from '../components/SkaterLogo';
import { SpotDetail } from '../components/SpotDetail';
import { EventDetail } from '../components/EventDetail';
import { AddSpotForm } from '../components/AddSpotForm';
import { EditProfileForm } from '../components/EditProfileForm';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MARKER_GREEN = '#a3ff12';
const MARKER_ORANGE = '#ff7a1a';
const LIGHT_ACCENT = '#96ab79';
// Desaturated terracotta, paired with LIGHT_ACCENT's sage green instead of
// the dark theme's fully-saturated orange (MARKER_ORANGE), which read too
// loud against the light map.
const LIGHT_EVENT_COLOR = '#d97e3f';

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

const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
  <button
    onClick={onToggle}
    className={cn(
      "shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors",
      on ? "bg-[#a3ff12] light:bg-[#96ab79]" : "bg-slate-700 light:bg-black"
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

interface SpotListItemProps {
  spot: Spot;
  origin: { lat: number; lng: number };
  parseCategories: (catString?: string) => string;
  onClick: () => void;
  formatDistance?: (km: number) => string;
}

const SpotListItem: React.FC<SpotListItemProps> = ({ spot, origin, parseCategories, onClick, formatDistance }) => {
  const distanceKm = getDistanceKm(origin.lat, origin.lng, spot.lat, spot.lng);
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col bg-slate-900/60 rounded-xl overflow-hidden hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700 text-left light:bg-white light:hover:bg-white light:border-black"
    >
      <img
        src={spot.image_url || PLACEHOLDER_IMAGE}
        alt={spot.name}
        className="w-full aspect-square object-cover bg-slate-900"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
      <div className="p-2.5 min-w-0">
        <h3 className="font-medium text-sm text-slate-200 group-hover:text-emerald-400 transition-colors line-clamp-2 light:text-black">{spot.name}</h3>
        <p className="text-xs text-[#a3ff12] font-semibold mt-1 light:text-[#96ab79]">{formatDistance ? formatDistance(distanceKm) : `${distanceKm.toFixed(1)} km`}</p>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono truncate light:text-slate-600">
            {parseCategories(spot.category)}
          </span>
          {spot.review_count ? (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="w-3 h-3 text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]" />
              <span className="text-xs font-semibold text-slate-200 light:text-black">{spot.rating!.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
};

interface EventListItemProps {
  event: UrbanEvent;
  onClick: () => void;
}

const EventListItem: React.FC<EventListItemProps> = ({ event, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700 bg-[#ff7a1a]/5 hover:bg-[#ff7a1a]/10 text-left light:bg-white light:hover:bg-white light:border-black"
  >
    <img
      src={event.image_url || PLACEHOLDER_IMAGE}
      alt={event.title}
      className={cn("w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-900", event.available === false && "grayscale opacity-60")}
      referrerPolicy="no-referrer"
      onError={handleImageError}
    />
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-slate-200 group-hover:text-[#ff7a1a] transition-colors truncate light:text-black">{event.title}</h3>
      <p className="text-xs text-slate-500 truncate light:text-slate-600">{event.location_name}</p>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <span className="text-[10px] text-[#ff7a1a] font-mono uppercase light:text-[#96ab79]">
          {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
        {event.available === false && (
          <span className="text-[10px] font-semibold text-slate-500 uppercase light:text-slate-600">No disponible</span>
        )}
        {event.review_count ? (
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-3 h-3 text-[#ff7a1a] fill-[#ff7a1a] light:text-[#96ab79] light:fill-[#96ab79]" />
            <span className="text-xs font-semibold text-slate-200 light:text-black">{event.rating!.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </div>
  </button>
);

interface DesktopLayoutProps {
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
  setIsOverlayMinimized: (v: boolean) => void;
  hoveredSpot: Spot | null;
  setHoveredSpot: (s: Spot | null) => void;
  mousePos: { x: number; y: number };
  setMousePos: (p: { x: number; y: number }) => void;
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

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
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
  setIsOverlayMinimized, hoveredSpot, setHoveredSpot, mousePos, setMousePos,
  handleLocateUser, isLocating, parseCategories,
  fetchSpotPhotos, fetchSpotReviews, fetchEventPhotos, fetchEventReviews,
  handleAddSpot, handleUploadSpotPhoto, handleSubmitReview, handleUploadEventPhoto, handleSubmitEventReview,
  handleDeleteSpot, handleDeleteEvent, handleApprove, handleReject,
  setIsUploading, setRouteTarget, onMapClick,
}) => {
  // Settings panel. Only "Unidades" actually does anything real right now
  // (it flips the km distance labels to miles) - the rest are visual/local-only:
  // there's no edit-profile form, no light map style built, no push notifications,
  // no account-privacy concept, and no help center yet. A backend/product pass
  // would need to persist these per-user instead of just in this component's state.
  const [showSettings, setShowSettings] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [unitsPreference, setUnitsPreference] = React.useState<'km' | 'mi'>('km');
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [privateAccount, setPrivateAccount] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState<'challenges' | 'favorites' | 'activity' | 'myspots'>('challenges');
  const [challengesSubTab, setChallengesSubTab] = React.useState<'active' | 'completed'>('active');

  const formatDistance = (km: number) => (
    unitsPreference === 'mi' ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`
  );

  const isLight = mapTypePreference === 'claro';

  // Spot/Evento map legend - doubles as a filter: null shows both, 'spot'
  // hides event markers, 'evento' hides spot markers. Clicking the active
  // one again clears back to null (both). Same behavior as MobileLayout.
  const [mapMarkerFilter, setMapMarkerFilter] = React.useState<'spot' | 'evento' | null>(null);

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

  // Un solo data URI por render, compartido por los 126 marcadores.
  const metroIcon = getMetroIcon(mapZoom);

  // Mismo motivo que en móvil: el panel lateral mantenía el scroll del spot
  // anterior al abrir otro desde el carrusel de relacionados.
  const detailScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (selectedSpot || selectedEvent) detailScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedSpot?.id, selectedEvent?.id]);

  const openSpotById = (spotId: string) => {
    const spot = spots.find(s => s.id === spotId);
    if (spot) openSpot(spot);
  };

  const openEvent = (event: UrbanEvent) => {
    setSelectedEvent(event);
    setSelectedSpot(null);
    fetchEventPhotos(event.id);
    fetchEventReviews(event.id);
    if (map) {
      map.panTo({ lat: event.lat, lng: event.lng });
      map.setZoom(16);
    }
  };

  return (
    <>
      {/* Desktop Vertical Nav */}
      <div className="hidden md:flex w-20 bg-[#0a0f02] border-r border-white/5 flex-col items-center py-8 gap-6 z-30 light:bg-white light:border-black">
        <div className="mb-6">
          <SkaterLogo size="md" />
        </div>

        <button
          onClick={() => { setActiveTab('map'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'map' && !selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Mapa"
        >
          <MapIcon className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Mapa</span>
        </button>

        <button
          onClick={() => { setActiveTab('list'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'list' && !selectedSpot ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Spots"
        >
          <ListIcon className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Spots</span>
        </button>

        <button
          onClick={() => { setIsAddingSpot(true); setSelectedSpot(null); setSelectedEvent(null); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", isAddingSpot ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Añadir Spot"
        >
          <Plus className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Añadir Spot</span>
        </button>

        <button
          onClick={() => { setActiveTab('events'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'events' && !selectedEvent ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Eventos"
        >
          <Calendar className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Eventos</span>
        </button>

        <button
          onClick={() => { setActiveTab('community'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'community' ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Comunidad"
        >
          <Users className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Comunidad</span>
        </button>

        <button
          onClick={() => { setActiveTab('profile'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
          className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'profile' ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
          title="Perfil"
        >
          {user ? (
            <img
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
              className="w-6 h-6 rounded-full"
              alt="Profile"
            />
          ) : (
            <User className="w-6 h-6" />
          )}
          <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Perfil</span>
        </button>

        <div className="mt-auto flex flex-col gap-6">
          {isAdmin && (
            <button
              onClick={() => { setShowAdminPanel(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); }}
              className={cn("p-3 rounded-2xl transition-all group relative", showAdminPanel ? "bg-[#a3ff12] text-black shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white" : "text-slate-500 hover:text-white hover:bg-white/5 light:text-black light:hover:bg-black light:hover:text-white")}
              title="Admin"
            >
              <ShieldCheck className="w-6 h-6" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 light:bg-black">Panel Admin</span>
            </button>
          )}
          <button
            onClick={() => setShowNotifications(true)}
            title="Notificaciones"
            className="relative p-3 text-slate-500 hover:text-white transition-colors light:text-black light:hover:text-[#96ab79]"
          >
            <Bell className="w-6 h-6" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#a3ff12] text-black text-[9px] font-bold flex items-center justify-center light:bg-[#96ab79] light:text-white">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden md:flex w-80 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex-col z-20 light:bg-white light:border-black">
        <div className="p-6 border-b border-slate-800 light:border-black">
          <h2 className="text-xl font-bold tracking-tighter text-white uppercase light:text-black">
            {isAddingSpot ? 'Nuevo Spot' :
             showAdminPanel ? 'Administración' :
             selectedSpot ? 'Detalle Spot' :
             selectedEvent ? 'Detalle Evento' :
             activeTab === 'community' ? 'Comunidad' :
             activeTab === 'profile' ? 'Perfil' :
             activeTab === 'events' ? 'Eventos' :
             activeTab === 'list' ? 'Explorar' : 'UrbanFlow'}
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1 light:text-slate-600">
            {isAddingSpot ? 'Comparte tu lugar' :
             showAdminPanel ? 'Revisión de clips' :
             selectedSpot ? selectedSpot.name :
             selectedEvent ? selectedEvent.title :
             activeTab === 'community' ? 'Feed de la red' :
             activeTab === 'profile' ? 'Tu progreso' :
             activeTab === 'events' ? 'Próximas fechas' :
             activeTab === 'list' ? 'Busca tu spot' : 'Discovery Network'}
          </p>
        </div>

        <div ref={detailScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'map' && (
            <>
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2 light:text-black">
                  <MapPin className="w-3 h-3" /> Spots Cercanos
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {spots.slice(0, 5).map(spot => (
                    <SpotListItem
                      key={spot.id}
                      spot={spot}
                      origin={currentUserLocation || userLocation}
                      parseCategories={parseCategories}
                      onClick={() => openSpot(spot)}
                      formatDistance={formatDistance}
                    />
                  ))}
                </div>
                {spots.length > 5 && (
                  <button
                    onClick={() => setActiveTab('list')}
                    className="w-full text-center py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors light:text-black light:hover:text-[#96ab79]"
                  >
                    Ver todos los spots
                  </button>
                )}
              </div>

              <div className="pt-4 space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2 light:text-black">
                  <Calendar className="w-3 h-3" /> Próximos Eventos
                </h2>
                {events.slice(0, 3).map(event => (
                  <EventListItem key={event.id} event={event} onClick={() => openEvent(event)} />
                ))}
                {events.length > 3 && (
                  <button
                    onClick={() => setActiveTab('events')}
                    className="w-full text-center py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-[#ff7a1a] transition-colors light:text-black light:hover:text-[#96ab79]"
                  >
                    Ver todos los eventos
                  </button>
                )}
              </div>
            </>
          )}

          {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'list' && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2 light:text-black">
                <Compass className="w-3 h-3" /> Todos los Spots
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {spots.map(spot => (
                  <SpotListItem
                    key={spot.id}
                    spot={spot}
                    origin={currentUserLocation || userLocation}
                    parseCategories={parseCategories}
                    onClick={() => openSpot(spot)}
                    formatDistance={formatDistance}
                  />
                ))}
              </div>
            </div>
          )}

          {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'events' && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2 light:text-black">
                <Calendar className="w-3 h-3" /> Calendario de Eventos
              </h2>
              {events.map(event => (
                <EventListItem key={event.id} event={event} onClick={() => openEvent(event)} />
              ))}
            </div>
          )}

          {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'community' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 light:text-black">Tendencias Urbanas</h3>
                <div className="flex flex-wrap gap-2 px-2">
                  {['#SkateSantiago', '#Kickflip', '#StreetStyle', '#Grind', '#BMXLife'].map(tag => (
                    <span key={tag} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-[#a3ff12] font-mono light:bg-white light:border-black light:text-[#96ab79]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'profile' && (
            <div className="space-y-3 px-1">
              {/* Portada + avatar superpuesto - myProfile.bannerURL con
                  BANNER_OPTIONS[0] como respaldo visual (igual que el
                  avatar dicebear más abajo: solo vista previa hasta que el
                  usuario elige/guarda uno propio en EditProfileForm). */}
              <div className="relative pb-8">
                <div className="relative aspect-[2.8/1] rounded-2xl overflow-hidden bg-slate-900 light:bg-white">
                  <img
                    src={myProfile?.bannerURL || BANNER_OPTIONS[0] || PLACEHOLDER_IMAGE}
                    alt="Portada de perfil"
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20" />
                </div>
                <div className="absolute -bottom-0 left-4">
                  {(myProfile?.photoURL || user?.photoURL) ? (
                    <img
                      src={myProfile?.photoURL || user?.photoURL || undefined}
                      className="w-16 h-16 rounded-full border-4 border-slate-900 object-cover light:border-white"
                      alt="Profile"
                    />
                  ) : user ? (
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                      className="w-16 h-16 rounded-full border-4 border-slate-900 light:border-white"
                      alt="Profile"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-slate-400 shrink-0 light:bg-white light:border-white light:text-black">
                      <User className="w-7 h-7" />
                    </div>
                  )}
                </div>
              </div>

              {/* pl-4 alineado con el left-4 del avatar de arriba, en vez
                  de ponerlo al lado. */}
              <div className="pl-4 min-w-0">
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
                      "flex-1 pb-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px text-center",
                      profileTab === t.id ? "text-[#a3ff12] border-[#a3ff12] light:text-[#96ab79] light:border-[#96ab79]" : "text-slate-500 border-transparent light:text-slate-600"
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
                          challengesSubTab === t.id ? "text-[#a3ff12] border-[#a3ff12] light:text-[#96ab79] light:border-[#96ab79]" : "text-slate-500 border-transparent light:text-slate-600"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {(myChallenges?.challenges ?? []).filter(c => challengesSubTab === 'active' ? !c.completed : c.completed).map(c => {
                      const Icon = CHALLENGE_ICONS[c.id] ?? Trophy;
                      const pct = Math.min(100, Math.round((c.progress / c.goal) * 100));
                      const isFeatured = c.id === FEATURED_CHALLENGE_ID;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-2xl p-4 border overflow-hidden",
                            isFeatured
                              ? "bg-[#a3ff12] border-[#a3ff12] shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:border-[#96ab79] light:shadow-none"
                              : "bg-slate-800/50 border-slate-800 light:bg-white light:border-black"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {isFeatured && (
                                <span className="inline-block text-[9px] font-bold text-black uppercase tracking-widest bg-black/15 px-1.5 py-0.5 rounded-md mb-1 light:text-white light:bg-white/20">
                                  Destacado
                                </span>
                              )}
                              <h3 className={cn("font-semibold line-clamp-2", isFeatured ? "text-black light:text-white" : "text-white light:text-black")}>{c.title}</h3>
                              <p className={cn("text-xs mt-1 line-clamp-2", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-400 light:text-slate-600")}>{c.description}</p>
                            </div>
                            <div className={cn(
                              "shrink-0 w-11 h-11 rounded-full flex items-center justify-center border",
                              isFeatured ? "bg-black/15 border-black/10 light:bg-white/20 light:border-white/20" : "bg-slate-900 border-slate-700 light:bg-white light:border-black"
                            )}>
                              <Icon className={cn("w-5 h-5", isFeatured ? "text-black light:text-white" : "text-[#a3ff12] light:text-[#96ab79]")} />
                            </div>
                          </div>
                          <div className="flex items-center justify-end mt-3">
                            <span className={cn("text-xs font-semibold", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-400 light:text-slate-600")}>{c.progress}/{c.goal}</span>
                          </div>
                          <div className={cn("w-full h-1.5 rounded-full overflow-hidden mt-1.5", isFeatured ? "bg-black/15 light:bg-white/20" : "bg-slate-900 light:bg-white light:border light:border-black")}>
                            <div
                              className={cn("h-full rounded-full", isFeatured ? "bg-black light:bg-white" : "bg-[#a3ff12] shadow-[0_0_8px_#a3ff12] light:bg-[#96ab79] light:shadow-none")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-3 gap-1">
                            <span className={cn("min-w-0 truncate text-[10px] font-semibold uppercase tracking-widest", isFeatured ? "text-black/70 light:text-white/80" : "text-slate-500 light:text-slate-600")}>Recompensa</span>
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
                    <p className="text-slate-600 text-[10px] mt-1 light:text-slate-600">Guarda spots tocando el corazón en su detalle</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(myProfile?.favorites ?? [])
                      .map(id => spots.find(s => s.id === id))
                      .filter((s): s is Spot => !!s)
                      .map(f => (
                        <button
                          key={f.id}
                          onClick={() => openSpot(f)}
                          className="flex flex-col text-left bg-slate-800/50 border border-slate-800 rounded-2xl overflow-hidden light:bg-white light:border-black"
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
                <MySpotsList spots={mySpots} onOpenSpot={openSpot} />
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setActiveTab('community')}
                  className="w-full flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all text-left light:bg-white light:border-black light:hover:bg-white"
                >
                  <div className="p-2 bg-[#a3ff12]/10 rounded-xl light:bg-white light:border light:border-black">
                    <Users className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" />
                  </div>
                  <span className="flex-1 text-left font-semibold text-white light:text-black">Comunidad</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 light:text-black" />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => { setShowAdminPanel(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); }}
                    className="w-full flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all text-left light:bg-white light:border-black light:hover:bg-white"
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
          )}

          {selectedEvent && (
            <EventDetail
              event={selectedEvent}
              photos={eventPhotos}
              reviews={eventReviews}
              userLocation={currentUserLocation || userLocation}
              onClose={() => setSelectedEvent(null)}
              onShowRoute={() => setRouteTarget({ lat: selectedEvent.lat, lng: selectedEvent.lng, name: selectedEvent.title, type: 'event' })}
              onUploadPhoto={handleUploadEventPhoto}
              onSubmitReview={handleSubmitEventReview}
              isAdmin={isAdmin}
              onDelete={handleDeleteEvent}
              isAttending={attendingEventIds.includes(selectedEvent.id)}
              attendeeCount={selectedEventAttendees}
              onToggleAttendance={() => handleToggleAttendance(selectedEvent.id)}
              nearbySpots={getNearbySpots(selectedEvent, spots)}
              onOpenSpot={openSpot}
            />
          )}

          {selectedSpot && (
            <SpotDetail
              spot={selectedSpot}
              photos={spotPhotos}
              reviews={spotReviews}
              userLocation={currentUserLocation || userLocation}
              onClose={() => setSelectedSpot(null)}
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
              onOpenSpot={openSpot}
              nearbyEvents={getNearbyEvents(selectedSpot, events)}
              onOpenEvent={openEvent}
            />
          )}

          {isAddingSpot && (
            <AddSpotForm
              onClose={() => setIsAddingSpot(false)}
              onSubmit={handleAddSpot}
              newSpotCoords={newSpotCoords}
              setNewSpotCoords={setNewSpotCoords}
              geocodingLib={geocodingLib}
              map={map}
              setIsOverlayMinimized={setIsOverlayMinimized}
            />
          )}

          {showAdminPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2 light:text-black">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 light:text-[#96ab79]" /> Cola de Revisión
                </h2>
                <button onClick={() => setShowAdminPanel(false)} className="light:text-black"><X className="w-5 h-5" /></button>
              </div>

              {pendingVideos.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10 light:text-slate-600">La cola está vacía. ¡Buen trabajo!</p>
              ) : (
                <div className="space-y-6">
                  {pendingVideos.map(video => (
                    <div key={video.id} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 light:bg-white light:border-black">
                      <video src={video.video_url} className="w-full aspect-video object-cover" controls />
                      <div className="p-4 space-y-3">
                        <div>
                          <p className="text-[10px] uppercase font-mono text-slate-500 light:text-slate-600">Spot</p>
                          <p className="text-sm font-semibold light:text-black">{video.spot_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-mono text-slate-500 light:text-slate-600">Usuario</p>
                          <p className="text-sm light:text-black">{video.user_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(video.id)}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 light:bg-[#96ab79] light:hover:bg-[#96ab79] light:text-white"
                          >
                            <Check className="w-4 h-4" /> APROBAR
                          </button>
                          <button
                            onClick={() => handleReject(video.id)}
                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 py-2 rounded-lg font-semibold border border-rose-500/20 flex items-center justify-center gap-1 light:bg-white light:text-black light:border-black"
                          >
                            <X className="w-4 h-4" /> RECHAZAR
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="hidden md:flex flex-1 relative z-10 flex-col">
        <div className="flex-1 relative">
          {activeTab === 'community' && !selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel ? (
            <div className="w-full h-full bg-[#0a0f02] overflow-y-auto p-8 flex justify-center light:bg-white">
              <div className="w-full max-w-xl space-y-10 pb-20">
                <div className="flex items-center justify-between pb-4 border-b border-white/5 light:border-black">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight light:text-black">Comunidad UrbanFlow</h2>
                    <p className="text-xs text-slate-500 light:text-slate-600">Últimos trucos y sesiones compartidas</p>
                  </div>
                  <span className="text-[10px] bg-[#a3ff12]/10 border border-[#a3ff12]/20 text-[#a3ff12] px-3 py-1 rounded-full font-mono font-semibold light:bg-white light:border-black light:text-[#96ab79]">
                    EN VIVO
                  </span>
                </div>

                <div className="mb-8">
                  <StoriesRow posts={posts} onOpen={handleOpenPost} onCreate={() => setIsCreatingPost(true)} />
                </div>

                {posts.length === 0 ? (
                  <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center light:bg-white light:border-black">
                    <Camera className="w-12 h-12 text-slate-800 mx-auto mb-4 light:text-slate-300" />
                    <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">El feed está vacío</p>
                    <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en compartir un clip o una foto</p>
                    <button
                      onClick={() => setIsCreatingPost(true)}
                      className="mt-5 bg-[#a3ff12] text-black px-5 py-2.5 rounded-full text-xs font-bold hover:brightness-95 transition-all light:bg-[#96ab79] light:text-white"
                    >
                      PUBLICAR ALGO
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {posts.map(post => (
                      <div key={post.id} className="bg-slate-900/60 border border-white/5 rounded-[32px] p-6 light:bg-white light:border-black">
                        <PostCard
                          post={post}
                          onToggleLike={handleToggleLike}
                          onOpen={handleOpenPost}
                          onOpenAuthor={handleOpenPublicProfile}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : !GOOGLE_MAPS_API_KEY ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 p-10 text-center light:bg-white">
              <div className="max-w-md space-y-4">
                <MapPin className="w-12 h-12 text-slate-700 mx-auto light:text-slate-300" />
                <h2 className="text-xl font-semibold light:text-black">Se requiere una API Key de Google Maps</h2>
                <p className="text-slate-400 text-sm light:text-slate-600">
                  Por favor, añade tu API Key de Google Maps a las variables de entorno como <code className="bg-slate-800 px-1 rounded text-emerald-400 light:bg-white light:border light:border-black light:text-[#96ab79]">VITE_GOOGLE_MAPS_API_KEY</code> para habilitar el mapa.
                </p>
              </div>
            </div>
          ) : (
            <Map
              defaultCenter={userLocation}
              defaultZoom={13}
              styles={isLight ? MAP_STYLES_LIGHT : MAP_STYLES}
              onClick={onMapClick}
              className="w-full h-full google-map-dark"
              disableDefaultUI={true}
              gestureHandling={'greedy'}
              clickableIcons={false}
            >
              {/* Estaciones de metro: referencia visual, no interactivas -
                  clickable={false} evita que roben el clic a un pin de spot
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

              {mapMarkerFilter !== 'evento' && filteredSpots.map(spot => (
                <Marker
                  key={spot.id}
                  position={{ lat: spot.lat, lng: spot.lng }}
                  title={spot.name}
                  icon={getSpotPinIcon(mapZoom, selectedSpot?.id === spot.id, isLight)}
                  zIndex={selectedSpot?.id === spot.id ? 100 : undefined}
                  onClick={() => openSpot(spot)}
                  onMouseOver={(e) => {
                    setHoveredSpot(spot);
                    setMousePos({ x: e.domEvent.clientX, y: e.domEvent.clientY });
                  }}
                  onMouseOut={() => setHoveredSpot(null)}
                />
              ))}

              <AnimatePresence>
                {hoveredSpot && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                      left: mousePos.x,
                      top: mousePos.y - 10,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="p-2 w-[240px] bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 light:bg-white light:text-black light:border-black light:shadow-none">
                      <div className="relative h-32 w-full rounded-2xl overflow-hidden mb-3">
                        <img
                          src={hoveredSpot.image_url || PLACEHOLDER_IMAGE}
                          alt={hoveredSpot.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                        />
                        <div className="absolute top-3 right-3 bg-[#a3ff12] text-black text-[9px] font-bold px-2.5 py-1 rounded-full shadow-lg light:bg-[#96ab79] light:text-white light:shadow-none">
                          {parseCategories(hoveredSpot.category)}
                        </div>
                      </div>
                      <div className="px-2 pb-1">
                        <h3 className="text-sm font-bold text-white truncate light:text-black">{hoveredSpot.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#a3ff12] light:text-[#96ab79]" />
                          <span className="text-[11px] text-slate-400 font-semibold truncate light:text-slate-600">
                            {hoveredSpot.location_name || "Spot Urbano"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mapMarkerFilter !== 'spot' && events.map(event => (
                <Marker
                  key={`event-${event.id}`}
                  position={{ lat: event.lat, lng: event.lng }}
                  title={event.title}
                  icon={isLight ? getMarkerIcon(LIGHT_EVENT_COLOR, true, mapZoom) : getEventPinIcon(mapZoom, selectedEvent?.id === event.id)}
                  onClick={() => openEvent(event)}
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

          {/* Spot/Evento map legend - doubles as a filter (see
              mapMarkerFilter above): click one to show only that marker
              type, click it again to go back to showing both. */}
          {activeTab !== 'community' && !!GOOGLE_MAPS_API_KEY && (
            <div className="absolute top-6 left-6 z-[1000] flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-2xl shadow-2xl text-xs font-semibold text-white light:bg-white light:border-black light:text-black light:shadow-none">
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
          )}

          {/* Floating UI */}
          <div className="flex absolute top-6 right-6 flex-col gap-2 z-[1000]">
            <button
              onClick={handleLocateUser}
              disabled={isLocating}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl text-white hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-60 light:bg-white light:border-black light:text-black light:hover:bg-white light:shadow-none"
              title="Mi ubicación"
            >
              {isLocating ? (
                <div className="w-6 h-6 border-2 border-[#a3ff12] border-t-transparent rounded-full animate-spin light:border-[#96ab79]" />
              ) : (
                <Locate className="w-6 h-6 text-[#a3ff12] light:text-[#96ab79]" />
              )}
            </button>
            <div className="relative">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl flex items-center gap-3 light:bg-white light:border-black light:text-black light:shadow-none">
                {user ? (
                  <img
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    alt={user.displayName || 'User'}
                    className="w-10 h-10 rounded-full border border-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 light:bg-white light:border light:border-black light:text-black">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <p className="text-sm font-semibold truncate max-w-[100px]">{user ? (user.displayName || 'Rider') : 'Invitado'}</p>
                <button
                  onClick={() => setShowSettings(v => !v)}
                  className="p-2 bg-slate-800/50 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors shrink-0 light:bg-white light:border-black light:text-black light:hover:text-[#96ab79]"
                  title="Configuración"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={cn(
                      "absolute top-full right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-5 z-[1100] max-h-[80vh] overflow-y-auto light:bg-white light:border-black light:shadow-none",
                      showEditProfile ? "w-96" : "w-72"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {showEditProfile && (
                        <button onClick={() => setShowEditProfile(false)} className="text-slate-500 hover:text-white transition-colors -ml-1 light:text-black light:hover:text-[#96ab79]">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="flex-1 text-sm font-semibold text-white light:text-black">{showEditProfile ? 'Editar perfil' : 'Configuración'}</h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors light:text-black light:hover:text-[#96ab79]">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {showEditProfile ? (
                      <EditProfileForm user={user} profile={myProfile} onSave={handleUpdateProfile} />
                    ) : (
                    <>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Cuenta</h4>
                      <button
                        onClick={() => setShowEditProfile(true)}
                        className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition-colors text-left light:bg-white light:border-black light:hover:bg-white"
                      >
                        <User className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Editar perfil</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 light:text-black" />
                      </button>

                      {user ? (
                        <button
                          onClick={() => { if (window.confirm('¿Quieres cerrar sesión?')) { handleSignOut(); setShowSettings(false); } }}
                          className="w-full flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 hover:bg-rose-500/15 transition-colors text-left light:bg-white light:border-black"
                        >
                          <LogOut className="w-4 h-4 text-rose-500 light:text-[#96ab79]" />
                          <span className="flex-1 text-xs font-semibold text-rose-500 light:text-black">Cerrar sesión</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => { setIsGuest(false); setShowSettings(false); }}
                          className="w-full flex items-center gap-3 bg-[#a3ff12]/10 border border-[#a3ff12]/20 rounded-xl p-3 hover:bg-[#a3ff12]/15 transition-colors text-left light:bg-white light:border-black"
                        >
                          <LogIn className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                          <span className="flex-1 text-xs font-semibold text-[#a3ff12] light:text-black">Iniciar sesión</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Preferencias</h4>

                      <button
                        onClick={() => setUnitsPreference(p => p === 'km' ? 'mi' : 'km')}
                        className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition-colors text-left light:bg-white light:border-black light:hover:bg-white"
                      >
                        <Ruler className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Unidades</span>
                        <span className="text-[10px] text-slate-500 light:text-slate-600">{unitsPreference === 'mi' ? 'Millas (mi)' : 'Kilómetros (km)'}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 light:text-black" />
                      </button>

                      <button
                        onClick={() => setMapTypePreference(p => p === 'oscuro' ? 'claro' : 'oscuro')}
                        className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition-colors text-left light:bg-white light:border-black light:hover:bg-white"
                      >
                        <MapIcon className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Tipo de mapa</span>
                        <span className="text-[10px] text-slate-500 capitalize light:text-slate-600">{mapTypePreference}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 light:text-black" />
                      </button>

                      <div className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 light:bg-white light:border-black">
                        <Bell className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Notificaciones</span>
                        <ToggleSwitch on={notificationsEnabled} onToggle={() => setNotificationsEnabled(v => !v)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Privacidad</h4>
                      <div className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 light:bg-white light:border-black">
                        <Shield className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Cuenta privada</span>
                        <ToggleSwitch on={privateAccount} onToggle={() => setPrivateAccount(v => !v)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Ayuda</h4>
                      <button
                        onClick={() => alert('Próximamente: centro de ayuda.')}
                        className="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 transition-colors text-left light:bg-white light:border-black light:hover:bg-white"
                      >
                        <HelpCircle className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
                        <span className="flex-1 text-xs font-semibold text-white light:text-black">Centro de ayuda</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 light:text-black" />
                      </button>
                    </div>
                    </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Ventanas nuevas en escritorio: van como panel centrado sobre el
          mapa, no como hoja a pantalla completa (eso es el patrón móvil). */}
      <AnimatePresence>
        {(showNotifications || openPost || isCreatingPost || publicProfile || isLoadingPublicProfile) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5500] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              if (isCreatingPost) setIsCreatingPost(false);
              else if (openPost) closePost();
              else if (publicProfile) setPublicProfile(null);
              else setShowNotifications(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-2xl light:bg-white light:border-black light:shadow-none"
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
                  onOpenSpot={(spot) => { setPublicProfile(null); closePost(); openSpot(spot); }}
                  onOpenPost={(post) => { setPublicProfile(null); handleOpenPost(post); }}
                />
              ) : isLoadingPublicProfile ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-[#a3ff12] border-t-transparent rounded-full animate-spin light:border-[#96ab79]" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white light:text-black">Notificaciones</h2>
                    <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors light:hover:bg-black/5">
                      <X className="w-5 h-5 text-white light:text-black" />
                    </button>
                  </div>
                  <NotificationsList
                    items={notifications}
                    onOpenSpot={(spotId) => { setShowNotifications(false); openSpotById(spotId); }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
