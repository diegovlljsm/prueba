import { Spot, UrbanEvent, VideoClip, SpotPhoto, SpotReview, EventPhoto, EventReview, UserProfile, ChallengesResponse, ActivityItem, AppNotification, CommunityPost, PostComment, PublicProfile } from '../types';
import { auth } from '../firebase';

// Builds an Authorization header with the current user's Firebase ID
// token. Every endpoint that writes data or is admin-only requires this -
// the server verifies the token (and, for admin routes, the caller's role
// in Firestore) before doing anything. En producción, una llamada sin token
// válido recibe 401; en desarrollo el servidor la atribuye a un usuario local
// de pruebas para poder probar los flujos de escritura sin credenciales de
// Firebase Admin (ver DEV_USER en serverAuth.ts).
async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    return {};
  }
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

// Las respuestas de lista se consumen directamente con .filter()/.map() en
// App.tsx y los layouts, así que un 500 (o el index.html del SPA cuando la
// ruta no coincide) colaría un valor no-array y reventaría el render entero.
// Preferimos fallar aquí, donde cada caller ya tiene su try/catch.
async function readJsonArray<T>(res: Response, what: string): Promise<T[]> {
  if (!res.ok) throw new Error(`Failed to fetch ${what}: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Expected an array of ${what}`);
  return data;
}

export const api = {
  async fetchSpots(): Promise<Spot[]> {
    return readJsonArray<Spot>(await fetch('/api/spots'), 'spots');
  },

  async fetchEvents(): Promise<UrbanEvent[]> {
    return readJsonArray<UrbanEvent>(await fetch('/api/events'), 'events');
  },

  async fetchPendingVideos(): Promise<VideoClip[]> {
    const res = await fetch('/api/admin/pending-videos', {
      headers: await authHeaders(),
    });
    return readJsonArray<VideoClip>(res, 'pending videos');
  },

  async fetchSpotVideos(spotId: string): Promise<VideoClip[]> {
    return readJsonArray<VideoClip>(await fetch(`/api/spots/${spotId}/videos`), 'spot videos');
  },

  async deleteSpot(spotId: string): Promise<boolean> {
    const res = await fetch(`/api/spots/${spotId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async deleteEvent(eventId: string): Promise<boolean> {
    const res = await fetch(`/api/events/${eventId}`, {
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
  },

  async fetchSpotPhotos(spotId: string): Promise<SpotPhoto[]> {
    return readJsonArray<SpotPhoto>(await fetch(`/api/spots/${spotId}/photos`), 'spot photos');
  },

  async uploadPhoto(photoData: { spot_id: string, photo_url: string, user_name?: string }): Promise<{ id: string }> {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(photoData),
    });
    if (!res.ok) throw new Error('Failed to upload photo');
    return res.json();
  },

  async fetchSpotReviews(spotId: string): Promise<SpotReview[]> {
    return readJsonArray<SpotReview>(await fetch(`/api/spots/${spotId}/reviews`), 'spot reviews');
  },

  async submitReview(reviewData: { spot_id: string, rating: number, comment?: string, user_name?: string, user_avatar?: string }): Promise<{ id: string }> {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(reviewData),
    });
    if (!res.ok) throw new Error('Failed to submit review');
    return res.json();
  },

  async fetchEventPhotos(eventId: string): Promise<EventPhoto[]> {
    return readJsonArray<EventPhoto>(await fetch(`/api/events/${eventId}/photos`), 'event photos');
  },

  async uploadEventPhoto(photoData: { event_id: string, photo_url: string, user_name?: string }): Promise<{ id: string }> {
    const res = await fetch('/api/event-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(photoData),
    });
    if (!res.ok) throw new Error('Failed to upload event photo');
    return res.json();
  },

  async fetchEventReviews(eventId: string): Promise<EventReview[]> {
    return readJsonArray<EventReview>(await fetch(`/api/events/${eventId}/reviews`), 'event reviews');
  },

  async submitEventReview(reviewData: { event_id: string, rating: number, comment?: string, user_name?: string, user_avatar?: string }): Promise<{ id: string }> {
    const res = await fetch('/api/event-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(reviewData),
    });
    if (!res.ok) throw new Error('Failed to submit event review');
    return res.json();
  },

  async fetchMyProfile(): Promise<UserProfile> {
    const res = await fetch('/api/users/me', { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  async updateMyProfile(updates: Partial<Pick<UserProfile, 'displayName' | 'city' | 'discipline' | 'bio' | 'photoURL' | 'bannerURL' | 'instagram'>>): Promise<UserProfile> {
    const res = await fetch('/api/users/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  async addFavorite(spotId: string): Promise<boolean> {
    const res = await fetch(`/api/users/me/favorites/${spotId}`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async removeFavorite(spotId: string): Promise<boolean> {
    const res = await fetch(`/api/users/me/favorites/${spotId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async fetchMyChallenges(): Promise<ChallengesResponse> {
    const res = await fetch('/api/users/me/challenges', { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch challenges');
    return res.json();
  },

  async fetchMyActivity(): Promise<ActivityItem[]> {
    return readJsonArray<ActivityItem>(await fetch('/api/users/me/activity', { headers: await authHeaders() }), 'activity');
  },

  async fetchMySpots(): Promise<Spot[]> {
    return readJsonArray<Spot>(await fetch('/api/users/me/spots', { headers: await authHeaders() }), 'my spots');
  },

  async fetchNotifications(): Promise<AppNotification[]> {
    return readJsonArray<AppNotification>(await fetch('/api/users/me/notifications', { headers: await authHeaders() }), 'notifications');
  },

  async fetchMyAttendance(): Promise<string[]> {
    return readJsonArray<string>(await fetch('/api/users/me/attendance', { headers: await authHeaders() }), 'attendance');
  },

  async setAttendance(eventId: string, going: boolean): Promise<boolean> {
    const res = await fetch(`/api/events/${eventId}/attend`, {
      method: going ? 'POST' : 'DELETE',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async fetchEventAttendees(eventId: string): Promise<number> {
    const res = await fetch(`/api/events/${eventId}/attendees`);
    if (!res.ok) throw new Error('Failed to fetch attendees');
    const data = await res.json();
    return typeof data?.count === 'number' ? data.count : 0;
  },

  async fetchPosts(): Promise<CommunityPost[]> {
    return readJsonArray<CommunityPost>(await fetch('/api/posts', { headers: await authHeaders() }), 'posts');
  },

  async createPost(post: { image_url: string; caption?: string; tags?: string[]; spot_id?: string | null }): Promise<{ id: string }> {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(post),
    });
    if (!res.ok) throw new Error('Failed to create post');
    return res.json();
  },

  async deletePost(postId: string): Promise<boolean> {
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE', headers: await authHeaders() });
    return res.ok;
  },

  async setPostLike(postId: string, liked: boolean): Promise<boolean> {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: liked ? 'POST' : 'DELETE',
      headers: await authHeaders(),
    });
    return res.ok;
  },

  async fetchPostComments(postId: string): Promise<PostComment[]> {
    return readJsonArray<PostComment>(await fetch(`/api/posts/${postId}/comments`), 'comments');
  },

  async addPostComment(postId: string, text: string): Promise<{ id: string }> {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Failed to add comment');
    return res.json();
  },

  async fetchPublicProfile(uid: string): Promise<PublicProfile> {
    const res = await fetch(`/api/users/${uid}/public`);
    if (!res.ok) throw new Error('Failed to fetch public profile');
    return res.json();
  },

  async recordVisit(spotId: string, lat: number, lng: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch(`/api/spots/${spotId}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'No se pudo registrar la visita' };
    }
    return { ok: true };
  },
};
