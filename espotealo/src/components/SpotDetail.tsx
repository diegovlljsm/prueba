import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, TriangleAlert, Star, Video, Plus, Trash2, Heart,
  Navigation, Clock, MapPin, Camera, Send, X, Check, Calendar
} from 'lucide-react';
import { Spot, SpotPhoto, SpotReview, UrbanEvent } from '../types';
import { CATEGORIES } from '../constants';
import { PLACEHOLDER_IMAGE, handleImageError, getDistanceKm, cn, formatRelativeTime, eventCategoryLabel } from '../lib/utils';

interface SpotDetailProps {
  spot: Spot;
  photos: SpotPhoto[];
  reviews: SpotReview[];
  userLocation: { lat: number; lng: number };
  onClose: () => void;
  onUpload: () => void;
  onUploadPhoto: (photoDataUrl: string) => Promise<void>;
  onSubmitReview: (rating: number, comment: string) => Promise<void>;
  onShowRoute: () => void;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onVisit: () => Promise<boolean>;
  relatedSpots: Spot[];
  onOpenSpot: (spot: Spot) => void;
  nearbyEvents: UrbanEvent[];
  onOpenEvent: (event: UrbanEvent) => void;
}

const parseCategories = (catString?: string) => {
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
};

const StarRow = ({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        className={cn(size, n <= Math.round(rating) ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : 'text-slate-700 fill-slate-700 light:text-slate-300 light:fill-slate-300')}
      />
    ))}
  </div>
);

export const SpotDetail = ({
  spot, photos, reviews, userLocation,
  onClose, onUpload, onUploadPhoto, onSubmitReview, onShowRoute, isAdmin, onDelete,
  isFavorite, onToggleFavorite, onVisit, relatedSpots, onOpenSpot, nearbyEvents, onOpenEvent,
}: SpotDetailProps) => {
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isVisiting, setIsVisiting] = useState(false);
  const [justVisited, setJustVisited] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const tags = [spot.floor_quality, ...(spot.obstacles?.split(',') || [])]
    .map(t => t?.trim())
    .filter((t): t is string => !!t);

  const distanceKm = getDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);

  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 4);

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

  const handleVisitClick = async () => {
    setIsVisiting(true);
    try {
      const ok = await onVisit();
      if (ok) {
        setJustVisited(true);
        setTimeout(() => setJustVisited(false), 3000);
      }
    } finally {
      setIsVisiting(false);
    }
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
      {/* Desktop Header - mobile's back/favorite/share now live on top of
          the image below instead of a separate bar, but desktop keeps this
          plain header above the image. */}
      <div className="hidden md:flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors light:text-black light:hover:text-[#96ab79]"
        >
          <ChevronLeft className="w-4 h-4" /> Volver a la lista
        </button>
        <button
          onClick={onToggleFavorite}
          className="p-2 text-slate-400 hover:text-white transition-colors light:text-black light:hover:text-[#96ab79]"
        >
          <Heart className={cn('w-5 h-5 transition-colors', isFavorite ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : '')} />
        </button>
      </div>

      {/* 1. DETALLE ------------------------------------------------------ */}

      {/* Main Image - full bleed, header controls and title float on top
          of it (mobile only) instead of taking their own row above it.
          Negative margin cancels the parent sheet's p-6 padding on mobile
          (MobileLayout.tsx drops that padding's pt-0 too when a spot is
          selected) so the image reaches the sheet's top edge and both
          sides - only the bottom corners stay rounded there since the top
          now butts against the sheet's own rounded-t edge. Desktop keeps
          the original inset/rounded card look. */}
      <div className="relative -mx-6 -mt-6 md:mx-0 md:mt-0 rounded-b-[32px] md:rounded-[32px] overflow-hidden aspect-[4/3] shadow-2xl group light:shadow-none">
        <img
          src={spot.image_url || PLACEHOLDER_IMAGE}
          className="w-full h-full object-cover rounded-b-[32px] md:rounded-[32px] transition-transform duration-700 md:group-hover:scale-110"
          alt={spot.name}
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
        <div className="absolute inset-0 rounded-b-[32px] md:rounded-[32px] bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

        {/* Mobile Header - overlaid. Favorito se movió a la esquina inferior
            derecha de la imagen (ver más abajo) para dejar sitio arriba al
            botón de reportar estado; compartir se quitó. */}
        <div className="flex md:hidden items-center justify-between absolute top-0 inset-x-0 p-4 pt-8">
          <button onClick={onClose} className="p-2 bg-black/40 backdrop-blur-md rounded-full active:scale-90 transition-transform light:bg-white/90 light:border light:border-black">
            <ChevronLeft className="w-6 h-6 text-white light:text-black" />
          </button>
          <button
            onClick={() => setShowReviewForm(true)}
            className="flex items-center gap-1.5 pl-2.5 pr-3 py-2 bg-black/40 backdrop-blur-md rounded-full active:scale-90 transition-transform light:bg-white/90 light:border light:border-black"
          >
            <TriangleAlert className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79] shrink-0" />
            <span className="text-xs font-semibold text-white light:text-black">Reportar estado</span>
          </button>
        </div>

        {/* Favorito - esquina inferior derecha de la imagen */}
        <button
          onClick={onToggleFavorite}
          className="flex md:hidden absolute bottom-6 right-6 p-2 bg-black/40 backdrop-blur-md rounded-full active:scale-90 transition-transform light:bg-white/90 light:border light:border-black"
        >
          <Heart className={cn('w-5 h-5 transition-colors', isFavorite ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : 'text-white light:text-black')} />
        </button>

        {/* Name + SPOT ACTIVO badge - overlaid at the bottom. El bloque está
            anclado abajo, así que un nombre largo crece hacia arriba: sin el
            line-clamp las primeras líneas se salían del recorte de la imagen
            y quedaban cortadas a media letra. */}
        <div className="absolute bottom-6 left-6 right-16 space-y-2">
          <h1 className="text-3xl font-bold text-white leading-tight tracking-tighter line-clamp-2">{spot.name}</h1>
          <div className="inline-block bg-[#a3ff12] text-black text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg shadow-[#a3ff12]/20 light:bg-[#96ab79] light:text-white light:shadow-none">
            SPOT ACTIVO
          </div>
        </div>
      </div>

      {/* Location, rating, tags, description */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[#a3ff12] light:text-[#96ab79]">
          <div className="w-2 h-2 bg-[#a3ff12] rounded-full animate-pulse light:bg-[#96ab79]" />
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">{spot.location_name || 'Ubicación registrada'}</p>
        </div>

        <div className="flex items-center gap-2">
          <StarRow rating={avgRating} />
          <span className="text-sm text-slate-400 font-semibold light:text-slate-600">
            {reviews.length > 0 ? `${avgRating.toFixed(1)} · ${reviews.length} Reseña${reviews.length === 1 ? '' : 's'}` : 'Sin reseñas aún'}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span key={i} className="text-xs font-semibold bg-[#a3ff12]/10 text-[#a3ff12] border border-[#a3ff12]/20 px-3 py-1.5 rounded-full light:bg-white light:text-black light:border-black">
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="text-slate-300 leading-relaxed text-sm light:text-slate-700">
          {spot.description || 'Sin descripción adicional.'}
        </p>

        <p className="text-xs text-slate-500 uppercase font-semibold tracking-widest light:text-slate-600">
          {parseCategories(spot.category)}
        </p>
      </div>

      {/* 2. FOTOS - cuadrícula justo bajo el banner: son las imágenes del mismo
          spot, así que se ven antes de cualquier otro dato. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <Camera className="w-5 h-5 text-[#a3ff12] light:text-[#96ab79]" /> FOTOS <span className="text-slate-500 text-sm light:text-slate-600">({photos.length})</span>
          </h3>
          {/* Aportar foto y clip van juntos: son la misma intención (sumar
              material al spot). La foto se publica al instante y el clip pasa
              por moderación, por eso una es la acción sólida y la otra el
              botón secundario. Textos cortos para que ambos quepan en móvil. */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="bg-[#a3ff12] text-black px-3 py-2 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-[#a3ff12]/20 active:scale-95 transition-all disabled:opacity-50 light:bg-[#96ab79] light:text-white light:shadow-none"
            >
              {isUploadingPhoto ? (
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin light:border-white" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              FOTO
            </button>
            <button
              onClick={onUpload}
              className="border-2 border-[#a3ff12]/40 text-[#a3ff12] px-3 py-2 rounded-full text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-all light:border-[#96ab79]/40 light:text-[#96ab79]"
            >
              <Video className="w-3.5 h-3.5" />
              CLIP
            </button>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
        </div>

        {photos.length === 0 ? (
          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center light:bg-white light:border-black">
            <Camera className="w-12 h-12 text-slate-800 mx-auto mb-4 light:text-slate-300" />
            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Aún no hay fotos</p>
            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en compartir una foto de este spot</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {visiblePhotos.map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900">
                  <img
                    src={photo.photo_url}
                    alt={`Foto de ${photo.user_name || 'un skater'}`}
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
                className="w-full text-center py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#a3ff12] transition-colors light:text-black light:hover:text-[#96ab79]"
              >
                {showAllPhotos ? 'Ver menos' : `Ver todas las fotos (${photos.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* 3. DATOS + CÓMO LLEGAR ------------------------------------------
          Horario y distancia van lado a lado, y las dos acciones también:
          antes eran dos tarjetas con cuatro filas apiladas y obligaban a
          bajar bastante antes de llegar a las fotos. */}
      <div className="bg-white/5 p-5 rounded-[24px] border border-white/5 space-y-4 light:bg-white light:border-black">
        <div className={cn('grid gap-4', spot.open_hours ? 'grid-cols-2' : 'grid-cols-1')}>
          {spot.open_hours && (
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 bg-[#a3ff12]/10 rounded-lg shrink-0 light:bg-white light:border light:border-black">
                <Clock className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase light:text-slate-600">Horarios</p>
                <p className="text-xs font-semibold text-white leading-snug light:text-black">{spot.open_hours}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 bg-[#a3ff12]/10 rounded-lg shrink-0 light:bg-white light:border light:border-black">
              <MapPin className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
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
            className="bg-[#a3ff12] hover:brightness-95 text-black font-bold text-[11px] py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 light:bg-[#96ab79] light:text-white"
          >
            <Navigation className="w-4 h-4 shrink-0" /> CÓMO LLEGAR
          </button>
          {/* GPS check-in - solo cuenta como "visita" si el navegador reporta
              una ubicación cercana al spot (ver POST /api/spots/:id/visit en
              server.ts), así los desafíos de "explorar en persona" no se
              pueden completar sin moverse. */}
          <button
            onClick={handleVisitClick}
            disabled={isVisiting}
            className="border-2 border-[#a3ff12]/40 text-[#a3ff12] font-bold text-[11px] py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 light:border-[#96ab79]/40 light:text-[#96ab79]"
          >
            {isVisiting ? (
              <div className="w-4 h-4 border-2 border-[#a3ff12] border-t-transparent rounded-full animate-spin shrink-0 light:border-[#96ab79]" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            {isVisiting ? 'CONFIRMANDO...' : justVisited ? '¡CONFIRMADA!' : 'MARCAR VISITA'}
          </button>
        </div>
      </div>

      {/* 4. RESEÑAS - compact horizontal carousel instead of a stacked
          list. ---------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <Star className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" /> RESEÑAS <span className="text-slate-500 text-xs light:text-slate-600">({reviews.length})</span>
          </h3>
          <button
            onClick={() => setShowReviewForm(v => !v)}
            className="bg-[#a3ff12] text-black px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#a3ff12]/20 active:scale-95 transition-all light:bg-[#96ab79] light:text-white light:shadow-none"
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
                <button onClick={() => setShowReviewForm(false)} className="text-slate-500 hover:text-white light:text-black light:hover:text-[#96ab79]">
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
                        n <= (hoveredStar || reviewRating) ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : 'text-slate-700 fill-slate-700 light:text-slate-300 light:fill-slate-300'
                      )}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-[#a3ff12] h-20 light:bg-white light:border-black light:focus:border-[#96ab79]"
                placeholder="¿Cómo fue tu experiencia en este spot?"
              />
              <button
                onClick={handleSubmitReviewForm}
                disabled={reviewRating === 0 || isSubmittingReview}
                className="w-full bg-[#a3ff12] disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 light:bg-[#96ab79] light:text-white"
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
            <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Aún no hay reseñas</p>
            <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Sé el primero en contar cómo está este spot</p>
          </div>
        ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-6 px-6 md:mx-0 md:px-0">
          {reviews.map(review => (
            <div key={review.id} className="shrink-0 w-56 bg-white/5 border border-white/5 rounded-2xl p-3.5 light:bg-white light:border-black">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_name || review.id}`}
                  className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 shrink-0"
                  alt={review.user_name || 'Usuario'}
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate light:text-black">{review.user_name || 'Anónimo'}</p>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider light:text-slate-600">{formatRelativeTime(review.createdAt)}</p>
                </div>
              </div>
              <StarRow rating={review.rating} size="w-3 h-3" />
              {review.comment && (
                <p className="text-xs text-slate-300 leading-relaxed mt-1.5 line-clamp-3 light:text-slate-700">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* 5. SPOTS RELACIONADOS - carrusel horizontal. El orden lo da
          getRelatedSpots: primero los que comparten disciplina y, dentro de
          eso, los más cercanos. No es una recomendación editorial. */}
      {relatedSpots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <MapPin className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" /> SPOTS RELACIONADOS
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-6 px-6 md:mx-0 md:px-0">
            {relatedSpots.map(related => (
              <button
                key={related.id}
                onClick={() => onOpenSpot(related)}
                className="shrink-0 w-40 text-left rounded-2xl overflow-hidden bg-white/5 border border-white/5 active:scale-[0.98] transition-transform light:bg-white light:border-black"
              >
                <img
                  src={related.image_url || PLACEHOLDER_IMAGE}
                  alt={related.name}
                  className="w-full h-24 object-cover bg-slate-900"
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
                <div className="p-2.5 min-w-0">
                  <p className="text-xs font-bold text-white truncate light:text-black">{related.name}</p>
                  <p className="text-[10px] text-slate-500 truncate light:text-slate-600">
                    {getDistanceKm(spot.lat, spot.lng, related.lat, related.lng).toFixed(1)} km de aquí
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* 6. EVENTOS CERCA - tarjeta grande con la foto a sangre y los datos
          encima, igual que el destacado del feed. El vínculo con el spot es
          geográfico (ver getNearbyEvents): no hay un campo que diga que un
          evento se hizo aquí, así que se muestra la distancia real en vez de
          afirmar que fue "en este spot". */}
      {nearbyEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 light:text-black">
            <Calendar className="w-4 h-4 text-[#ff7a1a] light:text-[#d97e3f]" /> EVENTOS CERCA
          </h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 -mx-6 px-6 md:mx-0 md:px-0">
            {nearbyEvents.map(event => {
              const past = event.available === false;
              const eventKm = getDistanceKm(spot.lat, spot.lng, event.lat, event.lng);
              return (
                <button
                  key={event.id}
                  onClick={() => onOpenEvent(event)}
                  className="relative shrink-0 w-[280px] aspect-[3/4] rounded-[28px] overflow-hidden text-left active:scale-[0.98] transition-transform bg-slate-900"
                >
                  <img
                    src={event.image_url || PLACEHOLDER_IMAGE}
                    alt={event.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/45" />

                  <span className={cn(
                    'absolute top-4 left-4 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider',
                    past ? 'bg-white/90 text-slate-600' : 'bg-[#ff7a1a] text-black light:bg-[#d97e3f] light:text-white'
                  )}>
                    {past ? 'Ya se realizó' : eventCategoryLabel(event.category)}
                  </span>

                  <div className="absolute inset-x-5 bottom-5">
                    <h4 className="text-2xl font-bold text-white leading-tight tracking-tight line-clamp-2">{event.title}</h4>
                    <div className="flex items-center gap-2 mt-1.5 text-white">
                      <Calendar className="w-4 h-4 text-[#ff7a1a] light:text-[#d97e3f] shrink-0" />
                      <span className="text-sm font-bold">
                        {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-white/60">·</span>
                      <span className="text-sm font-bold">{eventKm.toFixed(1)} km</span>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70 mt-1.5 truncate">
                      {event.location_name || 'Ubicación registrada'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isAdmin && (
        <button
          onClick={() => onDelete(spot.id)}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-500/20 light:bg-white light:hover:bg-white light:text-[#96ab79] light:border-black"
        >
          <Trash2 className="w-4 h-4" /> ELIMINAR SPOT
        </button>
      )}
    </motion.div>
  );
};
