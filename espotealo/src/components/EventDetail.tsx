import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Share2, Star, Trash2, Heart,
  Navigation, MapPin, Calendar, Camera, Plus, Send, X, Users, Check
} from 'lucide-react';
import { UrbanEvent, EventPhoto, EventReview, Spot } from '../types';
import { PLACEHOLDER_IMAGE, handleImageError, getDistanceKm, cn, formatRelativeTime, eventCategoryLabel } from '../lib/utils';

interface EventDetailProps {
  event: UrbanEvent;
  photos: EventPhoto[];
  reviews: EventReview[];
  userLocation: { lat: number; lng: number };
  onClose: () => void;
  onShowRoute: () => void;
  onUploadPhoto: (photoDataUrl: string) => Promise<void>;
  onSubmitReview: (rating: number, comment: string) => Promise<void>;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  nearbySpots: Spot[];
  onOpenSpot: (spot: Spot) => void;
  isAttending: boolean;
  attendeeCount: number;
  onToggleAttendance: () => void;
}

const StarRow = ({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        className={cn(size, n <= Math.round(rating) ? 'text-[#ff7a1a] fill-[#ff7a1a] light:text-black light:fill-black' : 'text-slate-700 fill-slate-700 light:text-slate-300 light:fill-slate-300')}
      />
    ))}
  </div>
);

export const EventDetail = ({
  event, photos, reviews, userLocation,
  onClose, onShowRoute, onUploadPhoto, onSubmitReview, isAdmin, onDelete,
  isAttending, attendeeCount, onToggleAttendance, nearbySpots, onOpenSpot,
}: EventDetailProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const distanceKm = getDistanceKm(userLocation.lat, userLocation.lng, event.lat, event.lng);
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 4);
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 2);

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      setIsUploadingPhoto(true);
      try {
        await onUploadPhoto(reader.result as string);
      } finally {
        setIsUploadingPhoto(false);
        if (photoInputRef.current) photoInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReviewForm = async () => {
    if (reviewRating === 0) return;
    setIsSubmittingReview(true);
    try {
      await onSubmitReview(reviewRating, reviewComment.trim());
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment('');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-10"
    >
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between mb-4 bg-slate-900/80 backdrop-blur-md z-10 py-2 light:bg-white">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black">
          <ChevronLeft className="w-6 h-6 text-white light:text-black" />
        </button>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 light:text-black">Detalle del Evento</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFavorite(v => !v)}
            className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black"
          >
            <Heart className={cn('w-5 h-5 transition-colors', isFavorite ? 'text-[#ff7a1a] fill-[#ff7a1a] light:text-black light:fill-black' : 'text-white light:text-black')} />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: event.title, text: event.description, url: window.location.href }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Enlace copiado al portapapeles');
              }
            }}
            className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black"
          >
            <Share2 className="w-5 h-5 text-[#ff7a1a] light:text-black" />
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors light:text-black"
        >
          <ChevronLeft className="w-4 h-4" /> Volver a la lista
        </button>
        <button
          onClick={() => setIsFavorite(v => !v)}
          className="p-2 text-slate-400 hover:text-white transition-colors light:text-black"
        >
          <Heart className={cn('w-5 h-5 transition-colors', isFavorite ? 'text-[#ff7a1a] fill-[#ff7a1a] light:text-black light:fill-black' : '')} />
        </button>
      </div>

      {/* 1. DETALLE ------------------------------------------------------ */}

      <div className="relative rounded-[32px] overflow-hidden aspect-[4/3] shadow-2xl group light:shadow-none">
        <img
          src={event.image_url || PLACEHOLDER_IMAGE}
          className="w-full h-full object-cover rounded-[32px] transition-transform duration-700 md:group-hover:scale-110"
          alt={event.title}
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 bg-[#ff7a1a] text-black text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg light:bg-black light:text-white light:shadow-none">
          EVENTO
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h1 className="text-4xl md:text-3xl lg:text-5xl font-bold text-white leading-tight tracking-tighter light:text-black">{event.title}</h1>
          <div className="flex items-center gap-1.5 mt-1 text-[#ff7a1a] light:text-black">
            <div className="w-2 h-2 rounded-full animate-pulse bg-[#ff7a1a] light:bg-black" />
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">{event.location_name || 'Ubicación registrada'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StarRow rating={avgRating} />
          <span className="text-sm text-slate-400 font-semibold light:text-slate-600">
            {reviews.length > 0 ? `${avgRating.toFixed(1)} · ${reviews.length} Reseña${reviews.length === 1 ? '' : 's'}` : 'Sin reseñas aún'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff7a1a]/10 text-[#ff7a1a] border border-[#ff7a1a]/20 light:bg-white light:text-black light:border-black">
            {eventCategoryLabel(event.category).toUpperCase()}
          </span>
          {event.available === false && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600 light:bg-white light:text-black light:border-black">
              NO DISPONIBLE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-300 light:text-slate-700">
          <Calendar className="w-4 h-4 text-slate-500 light:text-black" />
          {new Date(event.date).toLocaleString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>

        {event.available === false && event.unavailable_reason && (
          <p className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 light:bg-white light:text-slate-700 light:border-black">
            {event.unavailable_reason}
          </p>
        )}

        <p className="text-slate-300 leading-relaxed text-sm light:text-slate-700">
          {event.description || 'Sin descripción adicional.'}
        </p>
      </div>

      {/* 2. FOTOS - cuadrícula bajo el banner, igual que en el detalle de
          un spot. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <Camera className="w-5 h-5 text-[#ff7a1a] light:text-black" /> FOTOS <span className="text-slate-500 text-sm light:text-slate-600">({photos.length})</span>
          </h3>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="bg-[#ff7a1a] text-black px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 light:bg-black light:text-white light:shadow-none"
          >
            {isUploadingPhoto ? (
              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin light:border-white" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            AGREGAR FOTO
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
        </div>

        {photos.length === 0 ? (
          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center light:bg-white light:border-black">
            <Camera className="w-12 h-12 text-slate-800 mx-auto mb-4 light:text-slate-300" />
            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Aún no hay fotos</p>
            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en compartir una foto de este evento</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {visiblePhotos.map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900">
                  <img
                    src={photo.photo_url}
                    alt={`Foto de ${photo.user_name || 'un asistente'}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={handleImageError}
                  />
                </div>
              ))}
            </div>
            {photos.length > 4 && (
              <button
                onClick={() => setShowAllPhotos(v => !v)}
                className="w-full text-center py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#ff7a1a] transition-colors light:text-black light:hover:text-black"
              >
                {showAllPhotos ? 'Ver menos' : `Ver todas las fotos (${photos.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* 3. DATOS + ACCIONES ----------------------------------------------
          Misma diagramación que el detalle de un spot: los dos datos lado a
          lado y las dos acciones debajo, en una sola tarjeta. El conteo de
          asistentes sale de /api/events/:id/attendees, no es decorativo:
          sube y baja con la gente que realmente marcó que va. */}
      <div className="bg-white/5 p-5 rounded-[24px] border border-white/5 space-y-4 light:bg-white light:border-black">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 bg-[#ff7a1a]/10 rounded-lg shrink-0 light:bg-white light:border light:border-black">
              <Calendar className="w-4 h-4 text-[#ff7a1a] light:text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase light:text-slate-600">Fecha</p>
              <p className="text-xs font-semibold text-white leading-snug light:text-black">
                {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 bg-[#ff7a1a]/10 rounded-lg shrink-0 light:bg-white light:border light:border-black">
              <MapPin className="w-4 h-4 text-[#ff7a1a] light:text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase light:text-slate-600">Distancia</p>
              <p className="text-xs font-semibold text-white leading-snug light:text-black">{distanceKm.toFixed(1)} km</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onShowRoute}
            className="bg-[#ff7a1a] hover:brightness-95 text-black font-bold text-[11px] py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 light:bg-black light:text-white"
          >
            <Navigation className="w-4 h-4 shrink-0" /> CÓMO LLEGAR
          </button>
          <button
            onClick={onToggleAttendance}
            className={cn(
              'font-bold text-[11px] py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 border-2',
              isAttending
                ? 'border-[#ff7a1a] bg-[#ff7a1a]/15 text-[#ff7a1a] light:border-black light:bg-white light:text-black'
                : 'border-[#ff7a1a]/40 text-[#ff7a1a] light:border-black/40 light:text-black'
            )}
          >
            {isAttending ? <><Check className="w-4 h-4 shrink-0" /> VOY A IR</> : <><Plus className="w-4 h-4 shrink-0" /> VOY A IR</>}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-slate-500 light:text-slate-600">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[11px]">
            {attendeeCount === 0
              ? 'Sé el primero en confirmar'
              : `${attendeeCount} rider${attendeeCount === 1 ? '' : 's'} ${attendeeCount === 1 ? 'confirmó' : 'confirmaron'}`}
          </p>
        </div>
      </div>

      {/* 4. RESEÑAS --------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <Star className="w-5 h-5 text-[#ff7a1a] light:text-black" /> RESEÑAS <span className="text-slate-500 text-sm light:text-slate-600">({reviews.length})</span>
          </h3>
          <button
            onClick={() => setShowReviewForm(v => !v)}
            className="bg-[#ff7a1a] text-black px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all light:bg-black light:text-white light:shadow-none"
          >
            <Plus className="w-4 h-4" /> ESCRIBIR RESEÑA
          </button>
        </div>

        <AnimatePresence>
          {showReviewForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/5 border border-white/10 rounded-[24px] p-5 space-y-4 overflow-hidden light:bg-white light:border-black"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest light:text-black">Tu calificación</p>
                <button onClick={() => setShowReviewForm(false)} className="text-slate-500 hover:text-white light:text-black">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    onMouseEnter={() => setHoveredStar(n)}
                    onMouseLeave={() => setHoveredStar(0)}
                  >
                    <Star
                      className={cn(
                        'w-8 h-8 transition-colors',
                        n <= (hoveredStar || reviewRating) ? 'text-[#ff7a1a] fill-[#ff7a1a] light:text-black light:fill-black' : 'text-slate-700 fill-slate-700 light:text-slate-300 light:fill-slate-300'
                      )}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none h-20 light:bg-white light:border-black"
                placeholder="¿Cómo fue tu experiencia en este evento?"
              />
              <button
                onClick={handleSubmitReviewForm}
                disabled={reviewRating === 0 || isSubmittingReview}
                className="w-full disabled:opacity-40 bg-[#ff7a1a] text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 light:bg-black light:text-white"
              >
                {isSubmittingReview ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin light:border-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                ENVIAR RESEÑA
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {reviews.length === 0 ? (
          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center light:bg-white light:border-black">
            <Star className="w-12 h-12 text-slate-800 mx-auto mb-4 light:text-slate-300" />
            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Sin reseñas aún</p>
            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en calificar este evento</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleReviews.map(review => (
                <div key={review.id} className="bg-white/5 border border-white/5 rounded-[24px] p-5 light:bg-white light:border-black">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_name || review.id}`}
                        className="w-9 h-9 rounded-full bg-slate-800 border border-white/10"
                        alt={review.user_name || 'Usuario'}
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-sm font-bold text-white light:text-black">{review.user_name || 'Anónimo'}</p>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider light:text-slate-600">{formatRelativeTime(review.createdAt)}</p>
                      </div>
                    </div>
                    <StarRow rating={review.rating} size="w-3.5 h-3.5" />
                  </div>
                  {review.comment && (
                    <p className="text-sm text-slate-300 leading-relaxed light:text-slate-700">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
            {reviews.length > 2 && (
              <button
                onClick={() => setShowAllReviews(v => !v)}
                className="w-full text-center py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#ff7a1a] transition-colors light:text-black light:hover:text-black"
              >
                {showAllReviews ? 'Ver menos' : `Ver todas las reseñas (${reviews.length})`}
              </button>
            )}
          </>
        )}
      </div>


      {/* 5. SPOTS CERCA - mismo formato de tarjeta que "spots relacionados"
          en el detalle de un spot, para que un spot se vea igual en toda la
          app. El vínculo es sólo geográfico (ver getNearbySpots). */}
      {nearbySpots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <MapPin className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" /> SPOTS CERCA
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-6 px-6 md:mx-0 md:px-0">
            {nearbySpots.map(nearby => (
              <button
                key={nearby.id}
                onClick={() => onOpenSpot(nearby)}
                className="shrink-0 w-40 text-left rounded-2xl overflow-hidden bg-white/5 border border-white/5 active:scale-[0.98] transition-transform light:bg-white light:border-black"
              >
                <img
                  src={nearby.image_url || PLACEHOLDER_IMAGE}
                  alt={nearby.name}
                  className="w-full h-24 object-cover bg-slate-900"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
                <div className="p-2.5 min-w-0">
                  <p className="text-xs font-bold text-white truncate light:text-black">{nearby.name}</p>
                  <p className="text-[10px] text-slate-500 truncate light:text-slate-600">
                    {getDistanceKm(event.lat, event.lng, nearby.lat, nearby.lng).toFixed(1)} km del evento
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(event.id)}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-500/20 light:bg-white light:hover:bg-white light:text-[#96ab79] light:border-black"
        >
          <Trash2 className="w-4 h-4" /> ELIMINAR EVENTO
        </button>
      )}
    </motion.div>
  );
};
