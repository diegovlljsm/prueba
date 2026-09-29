import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { X, Check, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Spot, VideoClip, UrbanEvent, SpotPhoto, SpotReview, EventPhoto, EventReview, UserProfile, ChallengesResponse, CommunityPost, PostComment, ActivityItem, AppNotification, PublicProfile } from './types';
import { CATEGORIES } from './constants';
import { SkaterLogo } from './components/SkaterLogo';
import { AuthScreen } from './components/AuthScreen';
import { EntryTransition } from './components/EntryTransition';
import { WelcomeOnboarding } from './components/WelcomeOnboarding';
import { RouteView } from './components/RouteView';
import { DesktopLayout } from './desktop/DesktopLayout';
import { MobileLayout } from './mobile/MobileLayout';
import { useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import { api } from './services/api';

// This file owns all shared state, data fetching, and business-logic
// handlers - the "data layer" both layouts are built on. The actual screen
// UI lives entirely in ./desktop (DesktopLayout) and ./mobile (MobileLayout):
// two separate component trees, only one of which is ever mounted at a
// time (picked by useIsMobile), so neither can leak into or collide with
// the other. Keep new mobile-only or desktop-only UI in those folders;
// keep anything both need (state, API calls, handlers) here.
export default function App() {
  const {
    user,
    isGuest,
    isLoadingAuth,
    isSigningIn,
    authError,
    showAuthScreen,
    isAdmin,
    handleGoogleSignIn,
    handleSignOut,
    handleContinueAsGuest,
    setIsGuest
  } = useAuth();

  const isMobile = useIsMobile();
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const [mapZoom, setMapZoom] = useState(13);

  // Light/dark theme ("Tema" / "Tipo de mapa" in Configuración). Lives here,
  // not inside each layout, so the data-theme attribute can be set on a
  // wrapper that's an ancestor of literally everything - both layouts, plus
  // RouteView/AuthScreen/modals, which are rendered as this component's
  // siblings, not as children of MobileLayout/DesktopLayout. See index.css
  // for the light: custom variant this attribute controls.
  const [mapTypePreference, setMapTypePreference] = useState<'oscuro' | 'claro'>('claro');

  // Plays the intro video once, right after entering as guest, before the
  // map is revealed. Only wired to guest login for now, per request.
  const [showEntryTransition, setShowEntryTransition] = useState(false);
  const handleContinueAsGuestWithIntro = () => {
    handleContinueAsGuest();
    setShowEntryTransition(true);
  };

  // Onboarding (3 slides, see WelcomeOnboarding.tsx) - shows on every load
  // right now (per request, for review/testing), after auth/entry-transition
  // settle so it never stacks on top of those. The localStorage
  // "seen once" gate is commented out below, not deleted, so it's a
  // one-line flip back to "first run only" once this is ready to ship.
  const ONBOARDING_SEEN_KEY = 'urbanflow_onboarding_seen';
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (isLoadingAuth || showAuthScreen || showEntryTransition) return;
    // if (!localStorage.getItem(ONBOARDING_SEEN_KEY)) setShowOnboarding(true);
    setShowOnboarding(true);
  }, [isLoadingAuth, showAuthScreen, showEntryTransition]);
  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    setShowOnboarding(false);
  };

  // Pins shrink as the user zooms out so a crowded/national view of spots
  // doesn't turn into an overlapping wall of markers. See getMarkerIcon()
  // in MobileLayout/DesktopLayout for how mapZoom turns into pin size.
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      const z = map.getZoom();
      if (typeof z === 'number') setMapZoom(z);
    });
    return () => listener.remove();
  }, [map]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [events, setEvents] = useState<UrbanEvent[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UrbanEvent | null>(null);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotCoords, setNewSpotCoords] = useState<{lat: number, lng: number} | null>(null);
  const [pendingVideos, setPendingVideos] = useState<VideoClip[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [spotPhotos, setSpotPhotos] = useState<SpotPhoto[]>([]);
  const [spotReviews, setSpotReviews] = useState<SpotReview[]>([]);
  const [eventPhotos, setEventPhotos] = useState<EventPhoto[]>([]);
  const [eventReviews, setEventReviews] = useState<EventReview[]>([]);
  const [routeTarget, setRouteTarget] = useState<{ lat: number; lng: number; name: string; type?: 'spot' | 'event' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideoFileName, setSelectedVideoFileName] = useState<string>('');
  // Real (not mock) profile/favorites/challenges - see GET/PUT
  // /api/users/me* in server.ts. Persists across a guest session too
  // (the server falls back to a shared "local-skater" identity for
  // unauthenticated requests, same as every other write in this app).
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [myChallenges, setMyChallenges] = useState<ChallengesResponse | null>(null);
  // Comunidad, actividad, notificaciones y asistencia a eventos: todo real,
  // ver /api/posts, /api/users/me/activity|notifications|spots|attendance.
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [myActivity, setMyActivity] = useState<ActivityItem[]>([]);
  const [mySpots, setMySpots] = useState<Spot[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [attendingEventIds, setAttendingEventIds] = useState<string[]>([]);
  const [selectedEventAttendees, setSelectedEventAttendees] = useState(0);
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);
  const [openPostComments, setOpenPostComments] = useState<PostComment[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [isLoadingPublicProfile, setIsLoadingPublicProfile] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: -33.4489, lng: -70.6693 });
  const [currentUserLocation, setCurrentUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'events' | 'admin' | 'community' | 'profile'>('map');
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'spot' | 'event'; id: string } | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [showMapFilter, setShowMapFilter] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  // Desktop-only hover preview state; harmless if unused on mobile.
  const [hoveredSpot, setHoveredSpot] = useState<Spot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const parseCategories = useCallback((catString?: string) => {
    if (!catString) return 'Skateboarding';
    try {
      const cats = JSON.parse(catString);
      if (Array.isArray(cats)) {
        return cats.map(catId => CATEGORIES.find(c => c.id === catId)?.name || catId).join(', ');
      }
      return catString;
    } catch {
      return catString;
    }
  }, []);

  const filteredSpots = useMemo(() => {
    return spots.filter(spot => {
      const matchesQuery = mapSearchQuery.trim()
        ? [spot.name, spot.location_name, spot.description]
            .filter(Boolean)
            .some(field => field!.toLowerCase().includes(mapSearchQuery.trim().toLowerCase()))
        : true;
      const matchesCategory = activeCategoryFilter
        ? (spot.category || '').includes(activeCategoryFilter)
        : true;
      return matchesQuery && matchesCategory;
    });
  }, [spots, mapSearchQuery, activeCategoryFilter]);

  const fetchSpots = useCallback(async () => {
    try {
      const data = await api.fetchSpots();
      setSpots(data);
    } catch (error) {
      console.error('Error fetching spots:', error);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.fetchEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  const fetchMyProfile = useCallback(async () => {
    try {
      const data = await api.fetchMyProfile();
      setMyProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const fetchMyChallenges = useCallback(async () => {
    try {
      const data = await api.fetchMyChallenges();
      setMyChallenges(data);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      setPosts(await api.fetchPosts());
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, []);

  const fetchMyActivity = useCallback(async () => {
    try {
      setMyActivity(await api.fetchMyActivity());
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  }, []);

  const fetchMySpots = useCallback(async () => {
    try {
      setMySpots(await api.fetchMySpots());
    } catch (error) {
      console.error('Error fetching my spots:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifications(await api.fetchNotifications());
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  const fetchMyAttendance = useCallback(async () => {
    try {
      setAttendingEventIds(await api.fetchMyAttendance());
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }, []);

  // Optimista, igual que los favoritos: el corazón responde al toque y se
  // revierte si la petición falla, en vez de quedar mintiendo.
  const handleToggleLike = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const liked = !post.likedByMe;
    const apply = (value: boolean) => setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, likedByMe: value, likeCount: p.likeCount + (value ? 1 : -1) } : p
    ));
    apply(liked);
    try {
      const ok = await api.setPostLike(postId, liked);
      if (!ok) throw new Error('Like request failed');
    } catch (error) {
      console.error('Error toggling like:', error);
      apply(!liked);
    }
  };

  const handleCreatePost = async (post: { image_url: string; caption?: string; tags?: string[]; spot_id?: string | null }) => {
    await api.createPost(post);
    setIsCreatingPost(false);
    await fetchPosts();
    setSuccessMessage('¡Publicación compartida con la comunidad!');
    setShowSuccessMessage(true);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const ok = await api.deletePost(postId);
      if (!ok) throw new Error('Delete failed');
      setOpenPost(null);
      await fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('No se pudo borrar la publicación.');
    }
  };

  const handleOpenPost = async (post: CommunityPost) => {
    setOpenPost(post);
    setOpenPostComments([]);
    try {
      setOpenPostComments(await api.fetchPostComments(post.id));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (text: string) => {
    if (!openPost) return;
    try {
      await api.addPostComment(openPost.id, text);
      setOpenPostComments(await api.fetchPostComments(openPost.id));
      setPosts(prev => prev.map(p => p.id === openPost.id ? { ...p, commentCount: p.commentCount + 1 } : p));
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('No se pudo publicar tu comentario.');
    }
  };

  const handleToggleAttendance = async (eventId: string) => {
    const going = !attendingEventIds.includes(eventId);
    setAttendingEventIds(prev => going ? [...prev, eventId] : prev.filter(id => id !== eventId));
    setSelectedEventAttendees(c => Math.max(0, c + (going ? 1 : -1)));
    try {
      const ok = await api.setAttendance(eventId, going);
      if (!ok) throw new Error('Attendance request failed');
    } catch (error) {
      console.error('Error updating attendance:', error);
      setAttendingEventIds(prev => going ? prev.filter(id => id !== eventId) : [...prev, eventId]);
      setSelectedEventAttendees(c => Math.max(0, c + (going ? -1 : 1)));
    }
  };

  const handleOpenPublicProfile = async (uid: string) => {
    setIsLoadingPublicProfile(true);
    setPublicProfile(null);
    try {
      setPublicProfile(await api.fetchPublicProfile(uid));
    } catch (error) {
      console.error('Error fetching public profile:', error);
      alert('No se pudo cargar el perfil de este rider.');
    } finally {
      setIsLoadingPublicProfile(false);
    }
  };

  const fetchPendingVideos = useCallback(async () => {
    try {
      const data = await api.fetchPendingVideos();
      setPendingVideos(data);
    } catch (error) {
      console.error('Error fetching pending videos:', error);
    }
  }, []);

  const fetchSpotPhotos = useCallback(async (spotId: string) => {
    try {
      const data = await api.fetchSpotPhotos(spotId);
      setSpotPhotos(data);
    } catch (error) {
      console.error('Error fetching spot photos:', error);
    }
  }, []);

  const fetchSpotReviews = useCallback(async (spotId: string) => {
    try {
      const data = await api.fetchSpotReviews(spotId);
      setSpotReviews(data);
    } catch (error) {
      console.error('Error fetching spot reviews:', error);
    }
  }, []);

  const handleUploadSpotPhoto = async (photoDataUrl: string) => {
    if (!selectedSpot) return;
    try {
      await api.uploadPhoto({
        spot_id: selectedSpot.id,
        photo_url: photoDataUrl,
        user_name: user?.displayName || undefined,
      });
      await fetchSpotPhotos(selectedSpot.id);
      fetchMyChallenges();
      setSuccessMessage('¡Foto agregada!');
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('No se pudo subir la foto. Intenta de nuevo.');
    }
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!selectedSpot) return;
    try {
      await api.submitReview({
        spot_id: selectedSpot.id,
        rating,
        comment,
        user_name: user?.displayName || undefined,
        user_avatar: user?.photoURL || undefined,
      });
      await fetchSpotReviews(selectedSpot.id);
      fetchMyChallenges();
      setSuccessMessage('¡Gracias por tu reseña!');
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('No se pudo enviar la reseña. Intenta de nuevo.');
    }
  };

  const fetchEventPhotos = useCallback(async (eventId: string) => {
    try {
      const data = await api.fetchEventPhotos(eventId);
      setEventPhotos(data);
    } catch (error) {
      console.error('Error fetching event photos:', error);
    }
  }, []);

  const fetchEventReviews = useCallback(async (eventId: string) => {
    try {
      const data = await api.fetchEventReviews(eventId);
      setEventReviews(data);
    } catch (error) {
      console.error('Error fetching event reviews:', error);
    }
  }, []);

  const handleUploadEventPhoto = async (photoDataUrl: string) => {
    if (!selectedEvent) return;
    try {
      await api.uploadEventPhoto({
        event_id: selectedEvent.id,
        photo_url: photoDataUrl,
        user_name: user?.displayName || undefined,
      });
      await fetchEventPhotos(selectedEvent.id);
      fetchMyChallenges();
      setSuccessMessage('¡Foto agregada!');
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Error uploading event photo:', error);
      alert('No se pudo subir la foto. Intenta de nuevo.');
    }
  };

  const handleSubmitEventReview = async (rating: number, comment: string) => {
    if (!selectedEvent) return;
    try {
      await api.submitEventReview({
        event_id: selectedEvent.id,
        rating,
        comment,
        user_name: user?.displayName || undefined,
        user_avatar: user?.photoURL || undefined,
      });
      await fetchEventReviews(selectedEvent.id);
      fetchMyChallenges();
      setSuccessMessage('¡Gracias por tu reseña!');
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Error submitting event review:', error);
      alert('No se pudo enviar la reseña. Intenta de nuevo.');
    }
  };

  useEffect(() => {
    fetchSpots();
    fetchEvents();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, [fetchSpots, fetchEvents]);

  useEffect(() => {
    if (showAdminPanel) {
      fetchPendingVideos();
    }
  }, [showAdminPanel, fetchPendingVideos]);

  // Re-fetch whenever the signed-in identity changes (Google sign-in,
  // sign-out, or entering as guest) so one person never sees another's
  // cached profile/favorites/challenges after switching accounts.
  useEffect(() => {
    if (!user && !isGuest) {
      setMyProfile(null);
      setMyChallenges(null);
      setMyActivity([]);
      setMySpots([]);
      setNotifications([]);
      setAttendingEventIds([]);
      setPosts([]);
      return;
    }
    fetchMyProfile();
    fetchMyChallenges();
    fetchMyActivity();
    fetchMySpots();
    fetchNotifications();
    fetchMyAttendance();
    fetchPosts();
  }, [user, isGuest, fetchMyProfile, fetchMyChallenges, fetchMyActivity, fetchMySpots, fetchNotifications, fetchMyAttendance, fetchPosts]);

  // El conteo de asistentes se pide al abrir cada evento (no viene en
  // /api/events, que es público y cacheable) para que "¿Vas a ir?" muestre
  // siempre el número vigente.
  useEffect(() => {
    if (!selectedEvent) return;
    let cancelled = false;
    setSelectedEventAttendees(0);
    api.fetchEventAttendees(selectedEvent.id)
      .then(count => { if (!cancelled) setSelectedEventAttendees(count); })
      .catch(error => console.error('Error fetching attendees:', error));
    return () => { cancelled = true; };
  }, [selectedEvent]);

  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // Optimistic toggle: flips myProfile.favorites immediately so the heart
  // icon responds instantly, then fires the real request and reverts on
  // failure rather than leaving the UI showing a favorite that never saved.
  const handleToggleFavorite = async (spotId: string) => {
    const wasFavorite = (myProfile?.favorites ?? []).includes(spotId);
    setMyProfile(prev => prev ? {
      ...prev,
      favorites: wasFavorite ? prev.favorites.filter(id => id !== spotId) : [...prev.favorites, spotId],
    } : prev);
    try {
      const ok = wasFavorite ? await api.removeFavorite(spotId) : await api.addFavorite(spotId);
      if (!ok) throw new Error('Favorite request failed');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setMyProfile(prev => prev ? {
        ...prev,
        favorites: wasFavorite ? [...prev.favorites, spotId] : prev.favorites.filter(id => id !== spotId),
      } : prev);
    }
  };

  const handleUpdateProfile = async (updates: Partial<Pick<UserProfile, 'displayName' | 'city' | 'discipline' | 'bio' | 'photoURL' | 'bannerURL' | 'instagram'>>) => {
    const updated = await api.updateMyProfile(updates);
    setMyProfile(updated);
    return updated;
  };

  // GPS check-in for the "explora en persona" challenges. Reads a fresh,
  // high-accuracy geolocation fix (not the possibly-stale currentUserLocation
  // from the "locate me" button) and sends it to the server, which is the
  // one that actually decides whether it's close enough to the spot to
  // count - this function just surfaces the outcome. Returns false (after
  // showing an alert) for every failure path so SpotDetail can skip its
  // "confirmed" animation without needing to know why it failed.
  const handleVisitSpot = async (spotId: string): Promise<boolean> => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return false;
    }
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (error) => {
          console.error('Error getting location for visit:', error);
          if (error.code === error.PERMISSION_DENIED) {
            alert('No diste permiso de ubicación. Revisa los permisos de este sitio en tu navegador y vuelve a intentar.');
          } else if (error.code === error.TIMEOUT) {
            alert('Se agotó el tiempo buscando tu ubicación. Verifica tu señal GPS/conexión e intenta de nuevo.');
          } else {
            alert('No se pudo obtener tu ubicación. Verifica que el GPS de tu dispositivo esté activado.');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
    if (!position) return false;

    try {
      const result = await api.recordVisit(spotId, position.coords.latitude, position.coords.longitude);
      if (result.ok === false) {
        alert(result.error);
        return false;
      }
      fetchMyChallenges();
      return true;
    } catch (error) {
      console.error('Error recording visit:', error);
      alert('No se pudo registrar la visita. Intenta de nuevo.');
      return false;
    }
  };

  const handleDeleteSpot = (spotId: string) => {
    setDeleteTarget({ type: 'spot', id: spotId });
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteTarget({ type: 'event', id: eventId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const success = deleteTarget.type === 'spot'
        ? await api.deleteSpot(deleteTarget.id)
        : await api.deleteEvent(deleteTarget.id);

      if (success) {
        if (deleteTarget.type === 'spot') {
          setSelectedSpot(null);
          await fetchSpots();
          setSuccessMessage('Spot eliminado correctamente');
        } else {
          setSelectedEvent(null);
          await fetchEvents();
          setSuccessMessage('Evento eliminado correctamente');
        }
        setShowMobileOverlay(false);
        setShowSuccessMessage(true);
      }
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentUserLocation(pos);
        setIsLocating(false);
        if (map) {
          const zoomChanged = map.getZoom() !== 16;
          map.panTo(pos);
          // Calling setZoom() right after panTo() cuts the pan's glide
          // animation short, so it reads as a jump instead of a smooth
          // move. Wait for the pan to settle (map's 'idle' event) before
          // zooming in.
          if (zoomChanged) {
            google.maps.event.addListenerOnce(map, 'idle', () => {
              map.setZoom(16);
            });
          }
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          alert("No diste permiso de ubicación. Revisa los permisos de este sitio en tu navegador (icono junto a la barra de direcciones) y vuelve a intentar.");
        } else if (error.code === error.TIMEOUT) {
          alert("Se agotó el tiempo buscando tu ubicación. Verifica tu señal GPS/conexión e intenta de nuevo.");
        } else {
          alert("No se pudo obtener tu ubicación. Verifica que el GPS de tu dispositivo esté activado.");
        }
      },
      // enableHighAccuracy:true waits for a GPS-chip fix, which desktops/
      // laptops usually don't have - it just times out instead of falling
      // back to fast WiFi-based positioning. false is more reliable there
      // and still accurate enough on phones (which do have real GPS).
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleAddSpot = async (spotData: Partial<Spot>) => {
    try {
      await api.createSpot(spotData);
      setSuccessMessage('¡Spot creado y agregado al mapa con éxito!');
      setShowSuccessMessage(true);
      setIsAddingSpot(false);
      setShowMobileOverlay(false);
      setActiveTab('map');
      setNewSpotCoords(null);
      await fetchSpots();
      fetchMyChallenges();
    } catch (error) {
      console.error('Error adding spot:', error);
      throw error;
    }
  };

  const handleUploadVideo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSpot) return;

    const formData = new FormData(e.currentTarget);
    const userName = formData.get('user_name') as string;
    let videoUrl = formData.get('video_url') as string;

    try {
      if (uploadMethod === 'file') {
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const file = fileInput?.files?.[0];

        if (!file) {
          alert('Por favor selecciona un archivo');
          return;
        }

        setIsUploadingFile(true);
        setUploadProgress(0);
        const storageRef = ref(storage, `clips/${selectedSpot.id}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        videoUrl = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            () => {
              getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
            }
          );
        });
      }

      if (!videoUrl) {
        alert('Por favor proporciona una URL o selecciona un archivo');
        return;
      }

      const videoData = {
        spot_id: selectedSpot.id,
        video_url: videoUrl,
        user_name: userName,
      };

      await api.uploadVideo(videoData);
      setIsUploading(false);
      setIsUploadingFile(false);
      setSuccessMessage('¡Video enviado! Un administrador lo revisará pronto.');
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Error uploading video:', error);
      setIsUploadingFile(false);
      alert('Error al subir el video. Por favor intenta de nuevo.');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approveVideo(id);
      fetchPendingVideos();
    } catch (error) {
      console.error('Error approving video:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectVideo(id);
      fetchPendingVideos();
    } catch (error) {
      console.error('Error rejecting video:', error);
    }
  };

  const onMapClick = useCallback((e: any) => {
    if (isAddingSpot) {
      setNewSpotCoords({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
      setIsOverlayMinimized(false);
    } else if (selectedSpot && !showMobileOverlay) {
      setSelectedSpot(null);
    }
  }, [isAddingSpot, selectedSpot, showMobileOverlay, setIsOverlayMinimized]);

  const sharedLayoutProps = {
    user, isAdmin, handleSignOut, setIsGuest,
    myProfile, myChallenges, handleToggleFavorite, handleUpdateProfile, handleVisitSpot,
    map, geocodingLib, mapZoom, mapTypePreference, setMapTypePreference,
    spots, events, filteredSpots, pendingVideos,
    spotPhotos, spotReviews, eventPhotos, eventReviews,
    currentUserLocation, userLocation,
    selectedSpot, setSelectedSpot, selectedEvent, setSelectedEvent,
    isAddingSpot, setIsAddingSpot, newSpotCoords, setNewSpotCoords,
    showAdminPanel, setShowAdminPanel, activeTab, setActiveTab,
    setIsOverlayMinimized,
    handleLocateUser, isLocating, parseCategories,
    fetchSpotPhotos, fetchSpotReviews, fetchEventPhotos, fetchEventReviews,
    handleAddSpot, handleUploadSpotPhoto, handleSubmitReview, handleUploadEventPhoto, handleSubmitEventReview,
    handleDeleteSpot, handleDeleteEvent, handleApprove, handleReject,
    setIsUploading, setRouteTarget, onMapClick,
    posts, myActivity, mySpots, notifications, attendingEventIds, selectedEventAttendees,
    openPost, openPostComments, isCreatingPost, setIsCreatingPost,
    publicProfile, isLoadingPublicProfile, setPublicProfile,
    handleToggleLike, handleCreatePost, handleDeletePost, handleOpenPost,
    handleAddComment, handleToggleAttendance, handleOpenPublicProfile,
    closePost: () => setOpenPost(null),
  };

  return (
    <div data-theme={mapTypePreference === 'claro' ? 'light' : 'dark'}>
      <AnimatePresence mode="wait">
        {isLoadingAuth ? (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <SkaterLogo size="xl" className="shadow-2xl shadow-[#a3ff12]/20" />
              <div className="text-center">
                <h1 className="text-4xl font-semibold tracking-tighter text-white">URBANFLOW</h1>
                <p className="text-xs text-[#a3ff12] font-mono uppercase tracking-[0.3em] mt-2">Red de Spots</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
              className="h-1 bg-emerald-500/20 rounded-full mt-12 overflow-hidden"
            >
              <motion.div
                animate={{ x: [-200, 200] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-full h-full bg-[#a3ff12]"
              />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-screen w-full overflow-hidden font-sans bg-slate-950 text-slate-50 flex-col md:flex-row"
          >
            {isMobile ? (
              <MobileLayout
                {...sharedLayoutProps}
                showMobileOverlay={showMobileOverlay}
                setShowMobileOverlay={setShowMobileOverlay}
                isOverlayMinimized={isOverlayMinimized}
                addressSearch={addressSearch}
                setAddressSearch={setAddressSearch}
                mapSearchQuery={mapSearchQuery}
                setMapSearchQuery={setMapSearchQuery}
                showMapFilter={showMapFilter}
                setShowMapFilter={setShowMapFilter}
                activeCategoryFilter={activeCategoryFilter}
                setActiveCategoryFilter={setActiveCategoryFilter}
              />
            ) : (
              <DesktopLayout
                {...sharedLayoutProps}
                hoveredSpot={hoveredSpot}
                setHoveredSpot={setHoveredSpot}
                mousePos={mousePos}
                setMousePos={setMousePos}
              />
            )}

            {/* In-app route guidance */}
            <AnimatePresence>
              {routeTarget && (
                <RouteView
                  origin={currentUserLocation || userLocation}
                  destination={routeTarget}
                  onClose={() => setRouteTarget(null)}
                  isLight={mapTypePreference === 'claro'}
                />
              )}
            </AnimatePresence>

            {/* Upload Modal */}
            <AnimatePresence>
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-semibold">Subir Clip</h2>
                      <button onClick={() => setIsUploading(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <form onSubmit={handleUploadVideo} className="space-y-6">
                      <div className="flex bg-slate-800 p-1 rounded-xl mb-4">
                        <button
                          type="button"
                          onClick={() => setUploadMethod('file')}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                            uploadMethod === 'file' ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:text-slate-300")}
                        >
                          Galería
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMethod('url')}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                            uploadMethod === 'url' ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:text-slate-300")}
                        >
                          URL Link
                        </button>
                      </div>

                      {uploadMethod === 'file' ? (
                        <div className="space-y-2">
                          <label className="text-xs font-mono text-slate-500 uppercase">Seleccionar Video</label>
                          <div className="relative group">
                            <input
                              type="file"
                              accept="video/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedVideoFileName(file.name);
                                }
                              }}
                            />
                            <div className="w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-emerald-500/50 transition-colors">
                              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
                                <Camera className="w-6 h-6" />
                              </div>
                              <div className="text-center px-4 max-w-full overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate">
                                  {selectedVideoFileName || 'Toca para abrir la galería'}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">MP4, MOV hasta 50MB</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs font-mono text-slate-500 uppercase">URL del Video (MP4)</label>
                          <input
                            name="video_url"
                            required={uploadMethod === 'url'}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="https://ejemplo.com/clip.mp4"
                          />
                          <p className="text-[10px] text-slate-500">Usa un enlace directo a un archivo MP4.</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-mono text-slate-500 uppercase">Tu Nombre</label>
                        <input
                          name="user_name"
                          required
                          defaultValue={user?.displayName || ''}
                          readOnly={!!user}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                          placeholder="ej. Tony Hawk"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isUploadingFile}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex flex-col items-center justify-center gap-1 overflow-hidden relative"
                      >
                        {isUploadingFile && (
                          <motion.div
                            className="absolute bottom-0 left-0 h-1 bg-white/30"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                        )}
                        <div className="flex items-center justify-center gap-2">
                          {isUploadingFile ? (
                            <>
                              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                              SUBIENDO...
                            </>
                          ) : (
                            'ENVIAR PARA REVISIÓN'
                          )}
                        </div>
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {deleteTarget && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md"
                  >
                    <h2 className="text-2xl font-semibold mb-4 text-white">
                      {deleteTarget.type === 'spot' ? '¿Eliminar Spot?' : '¿Eliminar Evento?'}
                    </h2>
                    <p className="text-slate-400 mb-8">
                      {deleteTarget.type === 'spot'
                        ? '¿Estás seguro de que quieres eliminar este spot? Esta acción no se puede deshacer y borrará todos los videos asociados.'
                        : '¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.'}
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setDeleteTarget(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-semibold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmDelete}
                        className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-3 rounded-xl font-semibold transition-all"
                      >
                        Eliminar
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md bg-emerald-500 text-slate-950 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400"
                >
                  <div className="bg-white/20 p-2 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold leading-tight">
                    {successMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Selection Screen */}
      <AuthScreen
        show={showAuthScreen}
        isLoadingAuth={isLoadingAuth}
        isSigningIn={isSigningIn}
        authError={authError}
        onGoogleSignIn={handleGoogleSignIn}
        onContinueAsGuest={handleContinueAsGuestWithIntro}
      />

      <EntryTransition
        show={showEntryTransition}
        onFinish={() => setShowEntryTransition(false)}
      />

      <WelcomeOnboarding
        show={showOnboarding}
        user={user}
        onGoogleSignIn={handleGoogleSignIn}
        onViewSpots={() => { setActiveTab('list'); setShowMobileOverlay(true); }}
        onFinish={dismissOnboarding}
      />
    </div>
  );
}
