import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Map, 
  Marker, 
  InfoWindow,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Plus, 
  Video, 
  ShieldCheck, 
  X, 
  Check, 
  Navigation, 
  Layers,
  User,
  Bike,
  Activity,
  Calendar,
  Trophy,
  Users,
  Locate,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Bell,
  Compass,
  Home,
  Share2,
  Star,
  ChevronLeft,
  Grid,
  Search,
  UserCheck,
  Camera,
  Info,
  Trash2,
  LogIn,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Spot, VideoClip, UrbanEvent } from './types';
import { CATEGORIES, COMMUNITY_POSTS, STORIES, MAP_STYLES } from './constants';
import { SkaterLogo } from './components/SkaterLogo';
import { SpotDetail } from './components/SpotDetail';
import { EventDetail } from './components/EventDetail';
import { AuthScreen } from './components/AuthScreen';
import { AddSpotForm } from './components/AddSpotForm';
import { PopupSpot } from './components/PopupSpot';
import { RutaAlSpot } from './components/RutaAlSpot';
import { useAuth } from './hooks/useAuth';
import { useRuta } from './hooks/useRuta';
import { distanciaAlUsuario } from './lib/geo';
import { api } from './services/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const getMarkerIcon = (color: string) => {
  const svg = `<svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0Z" fill="${encodeURIComponent(color)}"/><circle cx="15" cy="15" r="6" fill="white" fill-opacity="0.3"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
};

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

  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [events, setEvents] = useState<UrbanEvent[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UrbanEvent | null>(null);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotCoords, setNewSpotCoords] = useState<{lat: number, lng: number} | null>(null);
  const [pendingVideos, setPendingVideos] = useState<VideoClip[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeVideos, setActiveVideos] = useState<VideoClip[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('file');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userLocation, setUserLocation] = useState({ lat: -33.4489, lng: -70.6693 });
  const [currentUserLocation, setCurrentUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'events' | 'admin' | 'community'>('map');
  const [hoveredSpot, setHoveredSpot] = useState<Spot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);
  const [spotToDelete, setSpotToDelete] = useState<string | null>(null);

  // Spot cuyo globo está abierto sobre el mapa. Separado de `selectedSpot`
  // a propósito: pulsar un marcador debe dar un vistazo rápido, no abrir la
  // ficha completa y tapar el mapa.
  const [spotEnPopup, setSpotEnPopup] = useState<Spot | null>(null);
  const [spotEnRuta, setSpotEnRuta] = useState<Spot | null>(null);

  // `userLocation` arranca en el centro de Santiago como posición por defecto
  // del mapa. Esta bandera distingue esa suposición de una lectura real del
  // GPS, para no enseñar distancias inventadas desde un punto donde nadie está.
  const [ubicacionEsReal, setUbicacionEsReal] = useState(false);

  const ruta = useRuta();

  const ubicacionUsuario = ubicacionEsReal ? userLocation : null;

  /** Abre el panel de ruta y calcula el trayecto desde donde está el usuario. */
  const handleComoLlegar = useCallback(
    (spot: Spot) => {
      if (!ubicacionUsuario) {
        alert('Necesitamos tu ubicación para trazar la ruta. Pulsa el botón de localizarte y concede el permiso.');
        return;
      }
      setSpotEnPopup(null);
      setSpotEnRuta(spot);
      ruta.calcular(ubicacionUsuario, { lat: spot.lat, lng: spot.lng });
    },
    [ubicacionUsuario, ruta]
  );

  const handleCerrarRuta = useCallback(() => {
    setSpotEnRuta(null);
    ruta.limpiar();
  }, [ruta]);

  /** Cambiar de modo recalcula sobre el mismo destino. */
  const handleCambiarModoRuta = useCallback(
    (modo: Parameters<typeof ruta.setModo>[0]) => {
      if (spotEnRuta && ubicacionUsuario) {
        ruta.calcular(ubicacionUsuario, { lat: spotEnRuta.lat, lng: spotEnRuta.lng }, modo);
      } else {
        ruta.setModo(modo);
      }
    },
    [spotEnRuta, ubicacionUsuario, ruta]
  );


  useEffect(() => {
    fetchSpots();
    fetchEvents();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUbicacionEsReal(true);
      });
    }
  }, []);

  useEffect(() => {
    if (showAdminPanel) {
      fetchPendingVideos();
    }
  }, [showAdminPanel]);

  useEffect(() => {
    if (map) {
      map.setOptions({ styles: MAP_STYLES });
    }
  }, [map, MAP_STYLES]);

  const parseCategories = (catString: string) => {
    try {
      const cats = JSON.parse(catString);
      if (Array.isArray(cats)) {
        return cats.map(catId => CATEGORIES.find(c => c.id === catId)?.name || catId).join(', ');
      }
      return catString;
    } catch (e) {
      return catString;
    }
  };

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

  const fetchPendingVideos = useCallback(async () => {
    try {
      const data = await api.fetchPendingVideos();
      setPendingVideos(data);
    } catch (error) {
      console.error('Error fetching pending videos:', error);
    }
  }, []);

  const fetchSpotVideos = useCallback(async (spotId: string) => {
    try {
      const data = await api.fetchSpotVideos(spotId);
      setActiveVideos(data);
    } catch (error) {
      console.error('Error fetching spot videos:', error);
    }
  }, [api]);

  /** Del globo del mapa a la ficha completa del spot. */
  const handleVerDetalleDesdePopup = useCallback(
    (spot: Spot) => {
      setSpotEnPopup(null);
      setSelectedSpot(spot);
      fetchSpotVideos(spot.id);
      if (window.innerWidth < 768) setShowMobileOverlay(true);
    },
    [fetchSpotVideos]
  );

  const handleDeleteSpot = (spotId: string) => {
    setSpotToDelete(spotId);
  };

  const confirmDeleteSpot = async () => {
    if (!spotToDelete) return;
    
    try {
      const success = await api.deleteSpot(spotToDelete);
      if (success) {
        setSelectedSpot(null);
        fetchSpots();
        setSuccessMessage('Spot eliminado correctamente');
        setShowSuccessMessage(true);
      }
    } catch (error) {
      console.error('Error deleting spot:', error);
    } finally {
      setSpotToDelete(null);
    }
  };

  const [addressSearch, setAddressSearch] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentUserLocation(pos);
          setUserLocation(pos);
          setUbicacionEsReal(true);
          if (map) {
            map.panTo(pos);
            map.setZoom(16);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("No se pudo obtener tu ubicación. Asegúrate de dar permisos.");
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización.");
    }
  };


  const handleAddSpot = async (spotData: Partial<Spot>) => {
    try {
      await api.createSpot(spotData);
      setSuccessMessage('¡Spot recibido! Revisaremos tu marca y en 24 horas podrá aparecer en el mapa.');
      setShowSuccessMessage(true);
      setIsAddingSpot(false);
      setShowMobileOverlay(false);
      setActiveTab('map');
      setNewSpotCoords(null);
      fetchSpots();
    } catch (error) {
      console.error('Error adding spot:', error);
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
    }
  }, [isAddingSpot, setIsOverlayMinimized]);

  return (
    <>
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
              <div className="p-4 bg-emerald-500 rounded-2xl shadow-2xl shadow-emerald-500/20">
                <Activity className="w-12 h-12 text-slate-950" />
              </div>
              <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tighter text-white">URBANFLOW</h1>
                <p className="text-xs text-emerald-500 font-mono uppercase tracking-[0.3em] mt-2">Red de Spots</p>
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
                className="w-full h-full bg-emerald-500"
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
            {/* Desktop Vertical Nav */}
            <div className="hidden md:flex w-20 bg-[#070f18] border-r border-white/5 flex-col items-center py-8 gap-6 z-30">
              <div className="p-3 bg-emerald-500 rounded-2xl mb-6">
                <Activity className="w-6 h-6 text-slate-950" />
              </div>
              
              <button 
                onClick={() => { setActiveTab('map'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
                className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'map' && !selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                title="Inicio"
              >
                <Home className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Inicio</span>
              </button>

              <button 
                onClick={() => { setActiveTab('list'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
                className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'list' && !selectedSpot ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                title="Spots"
              >
                <Compass className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Explorar Spots</span>
              </button>

              <button 
                onClick={() => { setIsAddingSpot(true); setSelectedSpot(null); setSelectedEvent(null); setShowAdminPanel(false); }}
                className={cn("p-3 rounded-2xl transition-all group relative", isAddingSpot ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                title="Añadir Spot"
              >
                <Plus className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Añadir Spot</span>
              </button>

              <button 
                onClick={() => { setActiveTab('events'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
                className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'events' && !selectedEvent ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                title="Eventos"
              >
                <MapPin className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Eventos</span>
              </button>

              <button 
                onClick={() => { setActiveTab('community'); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setShowAdminPanel(false); }}
                className={cn("p-3 rounded-2xl transition-all group relative", activeTab === 'community' ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                title="Comunidad"
              >
                <Users className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Comunidad</span>
              </button>

              <div className="mt-auto flex flex-col gap-6">
                {isAdmin && (
                  <button 
                    onClick={() => { setShowAdminPanel(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); }}
                    className={cn("p-3 rounded-2xl transition-all group relative", showAdminPanel ? "bg-[#baf413] text-black shadow-lg shadow-[#baf413]/20" : "text-slate-500 hover:text-white hover:bg-white/5")}
                    title="Admin"
                  >
                    <ShieldCheck className="w-6 h-6" />
                    <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">Panel Admin</span>
                  </button>
                )}
                <button className="p-3 text-slate-500 hover:text-white transition-colors">
                  <Bell className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Sidebar - Desktop Only */}
        <div className="hidden md:flex w-80 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex-col z-20">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-black tracking-tighter text-white uppercase">
              {isAddingSpot ? 'Nuevo Spot' : 
               showAdminPanel ? 'Administración' :
               selectedSpot ? 'Detalle Spot' :
               selectedEvent ? 'Detalle Evento' :
               activeTab === 'community' ? 'Comunidad' :
               activeTab === 'events' ? 'Eventos' :
               activeTab === 'list' ? 'Explorar' : 'UrbanFlow'}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mt-1">
              {isAddingSpot ? 'Comparte tu lugar' : 
               showAdminPanel ? 'Revisión de clips' :
               selectedSpot ? selectedSpot.name :
               selectedEvent ? selectedEvent.title :
               activeTab === 'community' ? 'Feed de la red' :
               activeTab === 'events' ? 'Próximas fechas' :
               activeTab === 'list' ? 'Busca tu spot' : 'Discovery Network'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'map' && (
              <>
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Spots Cercanos
                  </h2>
                  {spots.slice(0, 5).map(spot => (
                    <button
                      key={spot.id}
                      onClick={() => {
                        setSelectedSpot(spot);
                        setSelectedEvent(null);
                        fetchSpotVideos(spot.id);
                        if (map) {
                          map.panTo({ lat: spot.lat, lng: spot.lng });
                          map.setZoom(16);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">{spot.name}</h3>
                          <p className="text-xs text-slate-500 line-clamp-1">{[distanciaAlUsuario({ lat: spot.lat, lng: spot.lng }, ubicacionUsuario), spot.description].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-full text-slate-400 uppercase font-mono">
                          {parseCategories(spot.category)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {spots.length > 5 && (
                    <button 
                      onClick={() => setActiveTab('list')}
                      className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      Ver todos los spots
                    </button>
                  )}
                </div>

                <div className="pt-4 space-y-2">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Próximos Eventos
                  </h2>
                  {events.slice(0, 3).map(event => (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event);
                        setSelectedSpot(null);
                        if (map) {
                          map.panTo({ lat: event.lat, lng: event.lng });
                          map.setZoom(16);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700 bg-indigo-500/5 border-indigo-500/10"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">{event.title}</h3>
                          <p className="text-[10px] text-indigo-400 font-mono uppercase mt-1">
                            {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                        <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                          <Trophy className="w-3 h-3 text-indigo-400" />
                        </div>
                      </div>
                    </button>
                  ))}
                  {events.length > 3 && (
                    <button 
                      onClick={() => setActiveTab('events')}
                      className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      Ver todos los eventos
                    </button>
                  )}
                </div>
              </>
            )}

            {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'list' && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2">
                  <Compass className="w-3 h-3" /> Todos los Spots
                </h2>
                {spots.map(spot => (
                  <button
                    key={spot.id}
                    onClick={() => {
                      setSelectedSpot(spot);
                      setSelectedEvent(null);
                      fetchSpotVideos(spot.id);
                      if (map) {
                        map.panTo({ lat: spot.lat, lng: spot.lng });
                        map.setZoom(16);
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">{spot.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1">{[distanciaAlUsuario({ lat: spot.lat, lng: spot.lng }, ubicacionUsuario), spot.description].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-full text-slate-400 uppercase font-mono">
                        {parseCategories(spot.category)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'events' && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase px-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Calendario de Eventos
                </h2>
                {events.map(event => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setSelectedSpot(null);
                      if (map) {
                        map.panTo({ lat: event.lat, lng: event.lng });
                        map.setZoom(16);
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700 bg-indigo-500/5 border-indigo-500/10"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">{event.title}</h3>
                        <p className="text-[10px] text-indigo-400 font-mono uppercase mt-1">
                          {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                        <Trophy className="w-3 h-3 text-indigo-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!selectedSpot && !selectedEvent && !isAddingSpot && !showAdminPanel && activeTab === 'community' && (
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-sm text-slate-400 text-center py-10">El feed de la comunidad está cargando...</p>
                </div>
              </div>
            )}

            {selectedEvent && (
              <EventDetail 
                event={selectedEvent} 
                onClose={() => setSelectedEvent(null)} 
              />
            )}

            {selectedSpot && (
              <SpotDetail 
                spot={selectedSpot} 
                videos={activeVideos} 
                onClose={() => setSelectedSpot(null)}
                onUpload={() => setIsUploading(true)}
                isAdmin={isAdmin}
                onDelete={handleDeleteSpot}
                onComoLlegar={ubicacionUsuario ? handleComoLlegar : undefined}
                distancia={distanciaAlUsuario({ lat: selectedSpot.lat, lng: selectedSpot.lng }, ubicacionUsuario)}
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
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" /> Cola de Revisión
                  </h2>
                  <button onClick={() => setShowAdminPanel(false)}><X className="w-5 h-5" /></button>
                </div>

                {pendingVideos.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">La cola está vacía. ¡Buen trabajo!</p>
                ) : (
                  <div className="space-y-6">
                    {pendingVideos.map(video => (
                      <div key={video.id} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
                        <video src={video.video_url} className="w-full aspect-video object-cover" controls />
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-[10px] uppercase font-mono text-slate-500">Spot</p>
                            <p className="text-sm font-bold">{video.spot_name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-mono text-slate-500">Usuario</p>
                            <p className="text-sm">{video.user_name}</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleApprove(video.id)}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 rounded-lg font-bold flex items-center justify-center gap-1"
                            >
                              <Check className="w-4 h-4" /> APROBAR
                            </button>
                            <button 
                              onClick={() => handleReject(video.id)}
                              className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 py-2 rounded-lg font-bold border border-rose-500/20 flex items-center justify-center gap-1"
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
        <div className="flex-1 relative z-10 flex flex-col">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-4 bg-[#070f18] border-b border-white/5 z-50">
            <div className="flex items-center gap-2 select-none">
              <SkaterLogo />
              <h1 className="text-xl font-black tracking-tighter text-white">URBANFLOW</h1>
              {isAdmin && <ShieldCheck className="w-4 h-4 text-[#baf413]" />}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsAddingSpot(true)}
                className="p-2 bg-white/5 border border-white/10 rounded-xl text-white active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-white active:scale-95 transition-all">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            {!GOOGLE_MAPS_API_KEY ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 p-10 text-center">
                <div className="max-w-md space-y-4">
                  <MapPin className="w-12 h-12 text-slate-700 mx-auto" />
                  <h2 className="text-xl font-bold">Se requiere una API Key de Google Maps</h2>
                  <p className="text-slate-400 text-sm">
                    Por favor, añade tu API Key de Google Maps a las variables de entorno como <code className="bg-slate-800 px-1 rounded text-emerald-400">VITE_GOOGLE_MAPS_API_KEY</code> para habilitar el mapa.
                  </p>
                </div>
              </div>
            ) : (
              <Map
                defaultCenter={userLocation}
                defaultZoom={13}
                styles={MAP_STYLES}
                onClick={onMapClick}
                className="w-full h-full google-map-dark"
                disableDefaultUI={true}
                gestureHandling={'greedy'}
                clickableIcons={false}
              >
                {spots.map(spot => (
                  <Marker
                    key={spot.id}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    title={spot.name}
                    icon={getMarkerIcon(spot.marker_color || '#baf413')}
                    onClick={() => {
                      // Un toque abre el globo con el resumen; la ficha
                      // completa queda a un toque más, desde el propio globo.
                      setHoveredSpot(null);
                      setSpotEnPopup(spot);
                    }}
                    onMouseOver={(e) => {
                      if (window.innerWidth >= 768 && !spotEnPopup) {
                        setHoveredSpot(spot);
                        setMousePos({ x: e.domEvent.clientX, y: e.domEvent.clientY });
                      }
                    }}
                    onMouseOut={() => setHoveredSpot(null)}
                  />
                ))}

                {spotEnPopup && (
                  <InfoWindow
                    position={{ lat: spotEnPopup.lat, lng: spotEnPopup.lng }}
                    pixelOffset={[0, -38]}
                    onCloseClick={() => setSpotEnPopup(null)}
                    headerDisabled
                  >
                    <PopupSpot
                      spot={spotEnPopup}
                      ubicacionUsuario={ubicacionUsuario}
                      onComoLlegar={handleComoLlegar}
                      onVerDetalle={handleVerDetalleDesdePopup}
                    />
                  </InfoWindow>
                )}

            {/* Hover Preview - Desktop Only */}
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
                  <div className="p-2 w-[240px] bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
                    <div className="relative h-32 w-full rounded-2xl overflow-hidden mb-3">
                      <img 
                        src={hoveredSpot.image_url || `https://images.unsplash.com/photo-1520156584189-1ee29241274c?auto=format&fit=crop&q=80&w=800`} 
                        alt={hoveredSpot.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 right-3 bg-[#baf413] text-black text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg">
                        {parseCategories(hoveredSpot.category)}
                      </div>
                    </div>
                    <div className="px-2 pb-1">
                      <h3 className="text-sm font-black text-white truncate">{hoveredSpot.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#baf413]" />
                        <span className="text-[11px] text-slate-400 font-bold truncate">
                          {hoveredSpot.location_name || "Spot Urbano"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

                {events.map(event => (
                  <Marker
                    key={`event-${event.id}`}
                    position={{ lat: event.lat, lng: event.lng }}
                    title={event.title}
                    icon={getMarkerIcon('#6366f1')}
                    onClick={() => {
                      setSelectedEvent(event);
                      setSelectedSpot(null);
                      if (window.innerWidth < 768) {
                        setShowMobileOverlay(true);
                        setActiveTab('events');
                      }
                      if (map) {
                        map.panTo({ lat: event.lat, lng: event.lng });
                        map.setZoom(15);
                      }
                    }}
                  />
                ))}

                {newSpotCoords && (
                  <Marker 
                    position={newSpotCoords} 
                    icon={getMarkerIcon('#f43f5e')}
                  />
                )}

                {currentUserLocation && (
                  <Marker 
                    position={currentUserLocation} 
                    title="Tu ubicación" 
                    icon={getMarkerIcon('#3b82f6')}
                  />
                )}
              </Map>
            )}

            {/* Floating UI - Desktop Only */}
            <div className="hidden md:flex absolute top-6 right-6 flex-col gap-2 z-[1000]">
              <button 
                onClick={handleLocateUser}
                className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
                title="Mi ubicación"
              >
                <Locate className="w-6 h-6 text-[#baf413]" />
              </button>
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl">
                {user ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                      alt={user.displayName || 'User'} 
                      className="w-10 h-10 rounded-full border border-white/10"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold truncate max-w-[100px]">{user.displayName || 'Rider'}</p>
                      <button 
                        onClick={handleSignOut}
                        className="text-[10px] text-rose-500 font-black uppercase tracking-widest hover:text-rose-400 transition-colors"
                      >
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Invitado</p>
                      <button 
                        onClick={() => setIsGuest(false)}
                        className="text-[10px] text-[#baf413] font-black uppercase tracking-widest"
                      >
                        Iniciar Sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Locate Button */}
            <div className="md:hidden absolute top-24 right-4 z-[1000]">
              <button 
                onClick={handleLocateUser}
                className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl text-white active:scale-95 transition-all"
              >
                <Locate className="w-6 h-6 text-emerald-500" />
              </button>
            </div>

            {/* Mobile Bottom Sheet / Overlay */}
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
                  className="md:hidden fixed inset-x-0 bottom-0 top-20 bg-slate-900 z-[2000] rounded-t-[32px] border-t border-slate-800 overflow-hidden flex flex-col touch-none"
                >
                  <div className="flex-1 overflow-y-auto pb-24 touch-pan-y">
                    <div 
                      className="w-full pt-4 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
                      onClick={() => isOverlayMinimized && setIsOverlayMinimized(false)}
                    >
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-2" />
                      <p className="text-[10px] text-slate-600 font-mono text-center uppercase tracking-widest">
                        {isOverlayMinimized ? 'Toca para expandir' : 'Desliza para minimizar'}
                      </p>
                    </div>
                    
                    <div className="p-6">
              {isAddingSpot ? (
                <AddSpotForm 
                  onClose={() => {
                    setIsAddingSpot(false);
                    setNewSpotCoords(null);
                    setAddressSearch('');
                    if (window.innerWidth < 768) {
                      setShowMobileOverlay(false);
                      setActiveTab('map');
                    }
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
                          videos={activeVideos} 
                          onClose={() => {
                            setSelectedSpot(null);
                            setShowMobileOverlay(false);
                          }}
                          onUpload={() => setIsUploading(true)}
                          isAdmin={isAdmin}
                          onDelete={handleDeleteSpot}
                          onComoLlegar={ubicacionUsuario ? handleComoLlegar : undefined}
                          distancia={distanciaAlUsuario({ lat: selectedSpot.lat, lng: selectedSpot.lng }, ubicacionUsuario)}
                        />
                      ) : selectedEvent ? (
                        <EventDetail 
                          event={selectedEvent} 
                          onClose={() => {
                            setSelectedEvent(null);
                            setShowMobileOverlay(false);
                          }} 
                        />
                      ) : activeTab === 'list' ? (
                        <div className="space-y-4">
                        <h2 className="text-xl font-bold">Explorar Spots</h2>
                        <div className="grid gap-3">
                          {spots.map(spot => (
                            <button
                              key={spot.id}
                              onClick={() => {
                                setSelectedSpot(spot);
                                fetchSpotVideos(spot.id);
                                setIsOverlayMinimized(true);
                                if (map) {
                                  map.panTo({ lat: spot.lat, lng: spot.lng });
                                  map.setZoom(16);
                                }
                              }}
                              className="w-full text-left p-4 bg-slate-800/50 border border-slate-800 rounded-2xl"
                            >
                              <h3 className="font-bold text-emerald-400">{spot.name}</h3>
                              <p className="text-xs text-slate-500">{parseCategories(spot.category)}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : activeTab === 'events' ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-bold">Eventos Urbanos</h2>
                          <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Trophy className="w-5 h-5 text-indigo-400" />
                          </div>
                        </div>
                        <div className="grid gap-4">
                          {events.map(event => (
                            <button
                              key={event.id}
                              onClick={() => {
                                setSelectedEvent(event);
                                setIsOverlayMinimized(true);
                                if (map) {
                                  map.panTo({ lat: event.lat, lng: event.lng });
                                  map.setZoom(15);
                                }
                              }}
                              className="w-full text-left p-5 bg-slate-800/50 border border-slate-800 rounded-[24px] group active:scale-[0.98] transition-all"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded-md">
                                  {event.category}
                                </span>
                                <p className="text-xs font-bold text-slate-400">
                                  {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                </p>
                              </div>
                              <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors mb-1">{event.title}</h3>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <MapPin className="w-3 h-3" />
                                {event.location_name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : activeTab === 'admin' ? (
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">Cola de Revisión</h2>
                        {pendingVideos.map(video => (
                          <div key={video.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                            <video src={video.video_url} className="w-full rounded-xl mb-3" controls />
                            <p className="text-sm font-bold">{video.spot_name}</p>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => handleApprove(video.id)} className="flex-1 bg-emerald-500 text-slate-950 py-2 rounded-lg font-bold text-sm">Aprobar</button>
                              <button onClick={() => handleReject(video.id)} className="flex-1 bg-rose-500/10 text-rose-500 py-2 rounded-lg font-bold text-sm border border-rose-500/20">Rechazar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : activeTab === 'community' ? (
                      <div className="bg-[#070f18] min-h-screen -mx-6 -mt-6 pb-20 overflow-y-auto no-scrollbar">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-6 sticky top-0 bg-[#070f18]/90 backdrop-blur-xl z-50 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <SkaterLogo />
                            <h1 className="text-2xl font-black tracking-tighter text-white">URBANFLOW</h1>
                          </div>
                          <div className="flex items-center gap-3">
                            {user ? (
                              <button 
                                onClick={() => { if (window.confirm('¿Quieres cerrar sesión?')) handleSignOut(); }}
                                className="p-1 bg-white/5 rounded-full border border-white/10 active:scale-95 transition-all"
                              >
                                <img 
                                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                                  className="w-8 h-8 rounded-full" 
                                  alt="Profile" 
                                />
                              </button>
                            ) : (
                              <button 
                                onClick={() => setIsGuest(false)}
                                className="p-2.5 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all"
                              >
                                <User className="w-5 h-5 text-white" />
                              </button>
                            )}
                            <button className="p-2.5 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all">
                              <Bell className="w-5 h-5 text-white" />
                            </button>
                          </div>
                        </div>

                        {/* Stories */}
                        <div className="flex gap-5 px-6 py-6 overflow-x-auto no-scrollbar border-b border-white/5">
                          {STORIES.map(story => (
                            <div key={story.id} className="flex flex-col items-center gap-2 flex-shrink-0">
                              <div className="relative active:scale-90 transition-all">
                                <img src={story.avatar} className="w-16 h-16 rounded-full bg-slate-800 border border-white/10" alt={story.name} />
                                {story.isUser && (
                                  <div className="absolute bottom-0 right-0 bg-[#baf413] rounded-full p-1 border-2 border-[#070f18]">
                                    <Plus className="w-3 h-3 text-black" />
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{story.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Feed */}
                        <div className="space-y-12 py-8">
                          {COMMUNITY_POSTS.map(post => (
                            <div key={post.id} className="space-y-5">
                              {/* Post Header */}
                              <div className="flex items-center justify-between px-6">
                                <div className="flex items-center gap-4">
                                  <img src={post.user.avatar} className="w-11 h-11 rounded-full bg-slate-800 border border-white/10" alt={post.user.name} />
                                  <div>
                                    <h3 className="text-sm font-black text-white tracking-tight">{post.user.name}</h3>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                      <MapPin className="w-3 h-3 text-[#baf413]" />
                                      {post.user.location}
                                    </div>
                                  </div>
                                </div>
                                <button className="p-2 text-slate-500 hover:text-white transition-colors">
                                  <MoreHorizontal className="w-6 h-6" />
                                </button>
                              </div>

                              {/* Post Image */}
                              <div className="relative aspect-[4/5] mx-4 rounded-[40px] overflow-hidden shadow-2xl shadow-black/50 group">
                                <img src={post.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Skate trick" />
                                {post.isValidated && (
                                  <div className="absolute bottom-8 right-8 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-[#baf413]/30 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-[#baf413]" />
                                    <span className="text-[10px] font-black text-[#baf413] tracking-[0.2em] uppercase">Spot Validated</span>
                                  </div>
                                )}
                              </div>

                              {/* Post Actions */}
                              <div className="flex items-center justify-between px-8">
                                <div className="flex items-center gap-8">
                                  <button className="flex items-center gap-2.5 group active:scale-90 transition-all">
                                    <Heart className="w-8 h-8 text-[#baf413] fill-[#baf413]" />
                                    <span className="text-sm font-black text-white">{post.likes}</span>
                                  </button>
                                  <button className="flex items-center gap-2.5 group active:scale-90 transition-all">
                                    <MessageCircle className="w-8 h-8 text-white" />
                                    <span className="text-sm font-black text-white">{post.comments}</span>
                                  </button>
                                  <button className="active:scale-90 transition-all">
                                    <Send className="w-8 h-8 text-white" />
                                  </button>
                                </div>
                                <button className="active:scale-90 transition-all">
                                  <Bookmark className="w-8 h-8 text-white" />
                                </button>
                              </div>

                              {/* Post Caption */}
                              <div className="px-8 space-y-3">
                                <p className="text-sm leading-relaxed text-slate-200">
                                  <span className="font-black text-white mr-2">{post.user.name}</span>
                                  {post.caption}
                                </p>
                                <div className="flex flex-wrap gap-2.5">
                                  {post.tags.map(tag => (
                                    <span key={tag} className="text-sm text-[#baf413] font-bold tracking-tight">{tag}</span>
                                  ))}
                                </div>
                                <button className="text-xs text-slate-500 font-bold uppercase tracking-widest pt-2 hover:text-slate-400 transition-colors">
                                  View all {post.comments} comments
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Mobile Bottom Nav */}
          <div className="md:hidden bg-[#070f18] border-t border-white/5 px-6 py-3 pb-8 flex items-center justify-between z-[3000]">
            <button 
              onClick={() => { 
                if (activeTab === 'map' && !showMobileOverlay) return;
                setActiveTab('map'); setShowMobileOverlay(false); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false); setIsOverlayMinimized(false);
              }}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'map' && !showMobileOverlay ? "text-[#baf413]" : "text-slate-500")}
            >
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Inicio</span>
            </button>
            <button 
              onClick={() => { 
                if (activeTab === 'list' && showMobileOverlay) {
                  setShowMobileOverlay(false); setActiveTab('map');
                } else {
                  setActiveTab('list'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
                }
              }}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'list' && showMobileOverlay ? "text-[#baf413]" : "text-slate-500")}
            >
              <Compass className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Spots</span>
            </button>
            <button 
              onClick={() => { 
                if (isAddingSpot && showMobileOverlay) {
                  setIsAddingSpot(false); setShowMobileOverlay(false); setActiveTab('map');
                } else {
                  setIsAddingSpot(true); setShowMobileOverlay(true); setActiveTab('add'); setSelectedSpot(null); setSelectedEvent(null);
                }
              }}
              className={cn("w-14 h-14 rounded-full flex items-center justify-center shadow-2xl -mt-10 border-4 border-[#070f18] active:scale-95 transition-all", 
                isAddingSpot && showMobileOverlay ? "bg-slate-800 text-[#baf413]" : "bg-[#baf413] text-black shadow-[#baf413]/20")}
            >
              <Plus className={cn("w-8 h-8 transition-transform", isAddingSpot && showMobileOverlay ? "rotate-45" : "rotate-0")} />
            </button>
            <button 
              onClick={() => { 
                if (activeTab === 'community' && showMobileOverlay) {
                  setShowMobileOverlay(false); setActiveTab('map');
                } else {
                  setActiveTab('community'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
                }
              }}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'community' && showMobileOverlay ? "text-[#baf413]" : "text-slate-500")}
            >
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Comunidad</span>
            </button>
            <button 
              onClick={() => { 
                if (user) {
                  // Maybe show a profile modal or just sign out for now
                  if (window.confirm('¿Quieres cerrar sesión?')) handleSignOut();
                } else {
                  setIsGuest(false);
                }
              }}
              className="flex flex-col items-center gap-1 text-slate-500"
            >
              {user ? (
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  className="w-6 h-6 rounded-full border border-white/10" 
                  alt="Profile" 
                />
              ) : (
                <User className="w-6 h-6" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-widest">{user ? 'Perfil' : 'Login'}</span>
            </button>
            {isAdmin && (
              <button 
                onClick={() => { 
                  if (activeTab === 'admin' && showMobileOverlay) {
                    setShowMobileOverlay(false); setActiveTab('map');
                  } else {
                    setActiveTab('admin'); setShowMobileOverlay(true); setSelectedSpot(null); setSelectedEvent(null); setIsAddingSpot(false);
                  }
                }}
                className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'admin' && showMobileOverlay ? "text-[#baf413]" : "text-slate-500")}
              >
                <ShieldCheck className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Admin</span>
              </button>
            )}
          </div>
        </div>

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
                  <h2 className="text-2xl font-bold">Subir Clip</h2>
                  <button onClick={() => setIsUploading(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleUploadVideo} className="space-y-6">
                  <div className="flex bg-slate-800 p-1 rounded-xl mb-4">
                    <button 
                      type="button"
                      onClick={() => setUploadMethod('file')}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", 
                        uploadMethod === 'file' ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:text-slate-300")}
                    >
                      Galería
                    </button>
                    <button 
                      type="button"
                      onClick={() => setUploadMethod('url')}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", 
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
                              const label = e.target.nextElementSibling?.querySelector('.file-label');
                              if (label) label.textContent = file.name;
                            }
                          }}
                        />
                        <div className="w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-emerald-500/50 transition-colors">
                          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
                            <Camera className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-white file-label">Toca para abrir la galería</p>
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
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex flex-col items-center justify-center gap-1 overflow-hidden relative"
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
          {spotToDelete && (
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
                <h2 className="text-2xl font-bold mb-4 text-white">¿Eliminar Spot?</h2>
                <p className="text-slate-400 mb-8">¿Estás seguro de que quieres eliminar este spot? Esta acción no se puede deshacer y borrará todos los videos asociados.</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setSpotToDelete(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDeleteSpot}
                    className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-3 rounded-xl font-bold transition-all"
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
              <p className="text-sm font-bold leading-tight">
                {successMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )}
    </AnimatePresence>

    {/* Panel de ruta: lateral en escritorio, hoja inferior en móvil.
        Va por encima del mapa pero deja la línea trazada a la vista. */}
    <AnimatePresence>
      {spotEnRuta && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed z-[4000] border border-slate-800 overflow-hidden
                     inset-x-0 bottom-0 top-auto h-[72vh] rounded-t-[28px]
                     md:inset-y-4 md:left-auto md:right-4 md:top-4 md:bottom-4 md:h-auto md:w-[380px] md:rounded-[28px]
                     shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          <RutaAlSpot
            spot={spotEnRuta}
            origen={ubicacionUsuario}
            modo={ruta.modo}
            resumen={ruta.resumen}
            calculando={ruta.calculando}
            error={ruta.error}
            onCambiarModo={handleCambiarModoRuta}
            onCerrar={handleCerrarRuta}
          />
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
      onContinueAsGuest={handleContinueAsGuest}
    />
    </>
  );
}
