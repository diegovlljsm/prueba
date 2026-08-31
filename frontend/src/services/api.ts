import { Spot, UrbanEvent, VideoClip } from '../types';
import { auth } from '../firebase';

// Builds an Authorization header with the current user's Firebase ID
// token. Every endpoint that writes data or is admin-only requires this -
// the server verifies the token (and, for admin routes, the caller's role
// in Firestore) before doing anything. Without a signed-in user these
// calls correctly fail with 401 from the server rather than silently
// "working" client-side.
async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  async fetchSpots(): Promise<Spot[]> {
    const res = await fetch('/api/spots');
    return res.json();
  },

  async fetchEvents(): Promise<UrbanEvent[]> {
    const res = await fetch('/api/events');
    return res.json();
  },

  async fetchPendingVideos(): Promise<VideoClip[]> {
    const res = await fetch('/api/admin/pending-videos', {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch pending videos');
    return res.json();
  },

  async fetchSpotVideos(spotId: string): Promise<VideoClip[]> {
    const res = await fetch(`/api/spots/${spotId}/videos`);
    return res.json();
  },

  async deleteSpot(spotId: string): Promise<boolean> {
    const res = await fetch(`/api/spots/${spotId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async approveVideo(videoId: string): Promise<boolean> {
    const res = await fetch(`/api/admin/videos/${videoId}/approve`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async rejectVideo(videoId: string): Promise<boolean> {
    const res = await fetch(`/api/admin/videos/${videoId}/reject`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async createSpot(spotData: Partial<Spot>): Promise<{ id: string }> {
    const res = await fetch('/api/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(spotData),
    });
    if (!res.ok) throw new Error('Failed to create spot');
    return res.json();
  },

  async uploadVideo(videoData: { spot_id: string, video_url: string, user_name: string }): Promise<{ id: string }> {
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(videoData),
    });
    if (!res.ok) throw new Error('Failed to upload video');
    return res.json();
  }
};
