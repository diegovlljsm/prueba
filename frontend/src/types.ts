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
}

export interface Category {
  id: string;
  name: string;
  icon: ReactNode;
}

export interface CommunityPost {
  id: number;
  user: {
    name: string;
    avatar: string;
    location: string;
  };
  image: string;
  likes: string;
  comments: string;
  caption: string;
  tags: string[];
  isValidated: boolean;
}

export interface Story {
  id: number;
  name: string;
  avatar: string;
  isUser?: boolean;
}

export type { FirebaseUser };
