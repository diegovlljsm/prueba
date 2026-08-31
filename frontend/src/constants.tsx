import React from 'react';
import { Activity, Bike, Navigation, Layers } from 'lucide-react';
import { Category, CommunityPost, Story } from './types';
import { CATEGORY_IDS } from './constants.shared';

export const CATEGORIES: Category[] = [
  { id: CATEGORY_IDS[0], name: 'Skateboarding', icon: <Activity className="w-4 h-4" /> },
  { id: CATEGORY_IDS[1], name: 'BMX', icon: <Bike className="w-4 h-4" /> },
  { id: CATEGORY_IDS[2], name: 'Parkour', icon: <Navigation className="w-4 h-4" /> },
  { id: CATEGORY_IDS[3], name: 'Otro', icon: <Layers className="w-4 h-4" /> },
];

export const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 1,
    user: {
      name: 'skater_99',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=skater99',
      location: 'Parque Araucano, Santiago'
    },
    image: 'https://images.unsplash.com/photo-1547447134-cd3f5c716030?auto=format&fit=crop&q=80&w=800',
    likes: '1,240',
    comments: '42',
    caption: 'Nailed this kickflip at the local spot today. Concrete was smooth! 🛹🔥',
    tags: ['#SkateSantiago', '#Kickflip', '#StreetStyle'],
    isValidated: true
  },
  {
    id: 2,
    user: {
      name: 'nina_v',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ninav',
      location: 'MAC Forestal, Santiago'
    },
    image: 'https://images.unsplash.com/photo-1520156584189-1ee29241274c?auto=format&fit=crop&q=80&w=800',
    likes: '856',
    comments: '18',
    caption: 'Sunset sessions hit different. Finally got this line clean.',
    tags: ['#SkateLife', '#SantiagoSpots', '#Grind'],
    isValidated: false
  }
];

export const STORIES: Story[] = [
  { id: 1, name: 'Your Spot', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yours', isUser: true },
  { id: 2, name: 'tony_h', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tony' },
  { id: 3, name: 'skate_pro', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=skate' },
  { id: 4, name: 'nina_v', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nina' },
  { id: 5, name: 'shredder', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=shred' },
];

export const MAP_STYLES = [
  { "featureType": "all", "elementType": "geometry", "stylers": [{ "color": "#070f18" }] },
  { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
  { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b7885" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#131b24" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#8a97a6" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#1c232b" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#030a11" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "weight": 2 }] },
  { "featureType": "administrative.locality", "elementType": "labels.text", "stylers": [{ "scale": 1.2 }] },
  { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "visibility": "on" }, { "color": "#1b2504" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#74a007" }] },
  { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
];
