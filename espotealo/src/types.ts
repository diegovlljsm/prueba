import { ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';

export interface Spot {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
  marker_color: string;
  show_label: boolean;
  image_url?: string;
  location_name?: string;
  floor_quality?: string;
  obstacles?: string;
  open_hours?: string;
  rating?: number;
  review_count?: number;
  spot_type?: 'street' | 'park' | 'bowl' | 'diy';
  features?: string[];
  difficulty?: 'principiante' | 'intermedio' | 'avanzado';
  createdAt?: string;
}

export const SPOT_FEATURES = ['Ledges', 'Stairs', 'Manual Pads', 'Kickers', 'Bowls', 'Smooth Concrete', 'Lights'] as const;

export interface SpotPhoto {
  id: string;
  spot_id: string;
  photo_url: string;
  user_name?: string;
  createdAt?: string;
}

export interface SpotReview {
  id: string;
  spot_id: string;
  user_name?: string;
  user_avatar?: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface VideoClip {
  id: string;
  spot_id: string;
  video_url: string;
  status: 'pending' | 'approved' | 'rejected';
  user_name: string;
  spot_name?: string;
}

export interface UrbanEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location_name: string;
  lat: number;
  lng: number;
  category: 'jam' | 'contest' | 'workshop' | string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  // false = evento ya pasado o sin fecha oficial confirmada todavía - se
  // muestra igual (no se oculta) pero con una etiqueta "No disponible" y
  // el motivo en unavailable_reason. Ver mockEvents en server.ts.
  available?: boolean;
  unavailable_reason?: string;
}

export interface EventPhoto {
  id: string;
  event_id: string;
  photo_url: string;
  user_name?: string;
  createdAt?: string;
}

export interface EventReview {
  id: string;
  event_id: string;
  user_name?: string;
  user_avatar?: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: ReactNode;
}

// Publicación real del feed de Comunidad - ver GET/POST /api/posts.
// likeCount/commentCount/likedByMe los calcula el servidor en cada lectura
// a partir de las colecciones postLikes/postComments, nunca se almacenan.
export interface CommunityPost {
  id: string;
  image_url: string;
  caption: string;
  tags: string[];
  spot_id: string | null;
  user_name: string;
  user_avatar: string | null;
  createdBy: string;
  createdAt?: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  text: string;
  user_name: string;
  user_avatar: string | null;
  createdBy: string;
  createdAt?: string;
}

// Perfil público de otro rider - ver GET /api/users/:id/public. Sólo lo que
// esa persona ya muestra en la app; nunca email ni favoritos.
export interface PublicProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bannerURL: string | null;
  city: string | null;
  discipline: 'skate' | 'bmx' | 'parkour' | 'other' | null;
  bio: string | null;
  instagram: string | null;
  spotsCreated: number;
  postsCount: number;
  reviewsWritten: number;
  spots: Spot[];
  posts: CommunityPost[];
}

// Una entrada del historial "Actividad" del perfil - ver GET
// /api/users/me/activity. Se arma con lo que ya se guardaba (createdBy en
// spots, fotos, reseñas y visitas), no hay tabla de eventos detrás.
export interface ActivityItem {
  id: string;
  type: 'spot_created' | 'photo_uploaded' | 'review_written' | 'spot_visited';
  title: string;
  detail: string | null;
  rating?: number;
  spot_id: string | null;
  image_url: string | null;
  createdAt?: string;
}

// Notificación derivada: lo que otros hicieron en TUS spots - ver
// GET /api/users/me/notifications.
export interface AppNotification {
  id: string;
  type: 'review_on_my_spot' | 'photo_on_my_spot';
  actor: string;
  actor_avatar: string | null;
  spot_id: string;
  spot_name: string;
  rating?: number;
  detail: string | null;
  image_url?: string;
  createdAt?: string;
}

// Firestore users/{uid} doc - see GET/PUT /api/users/me in server.ts and
// the data model comment in firestore.rules. Real and persisted (not
// mock) as of the favoritos/perfil/desafíos backend pass.
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bannerURL: string | null;
  role: 'user' | 'admin';
  city: string | null;
  discipline: 'skate' | 'bmx' | 'parkour' | 'other' | null;
  bio: string | null;
  instagram: string | null;
  favorites: string[];
  createdAt?: string;
}

// One entry from GET /api/users/me/challenges - progress/completed/xp are
// computed server-side from this user's real spots/photos/reviews, never
// stored, so there's nothing here a client could fake by editing state.
export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: 'spotsCreated' | 'photosUploaded' | 'reviewsWritten' | 'spotsVisited';
  goal: number;
  xp: number;
  progress: number;
  completed: boolean;
}

// Los mismos contadores que alimentan los desafíos, sin recortar al goal -
// los muestra la fila de estadísticas del perfil.
export interface ProfileStats {
  spotsCreated: number;
  photosUploaded: number;
  reviewsWritten: number;
  spotsVisited: number;
}

export interface ChallengesResponse {
  challenges: Challenge[];
  xp: number;
  stats: ProfileStats;
}

export type { FirebaseUser };
