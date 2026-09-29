import React from 'react';
import { MapPin, Camera, Star, Footprints, Bell, ChevronLeft } from 'lucide-react';
import { ActivityItem, AppNotification, Spot } from '../types';
import { cn, PLACEHOLDER_IMAGE, handleImageError, formatRelativeTime } from '../lib/utils';

// Actividad, Mis spots y Notificaciones. Las tres listas salen de datos que
// la app ya guardaba (createdBy/createdAt en spots, fotos, reseñas y
// visitas) - ver /api/users/me/activity|spots|notifications. Ninguna
// inventa contenido: si están vacías es porque todavía no hay nada.

const ACTIVITY_LABELS: Record<ActivityItem['type'], { icon: typeof MapPin; verb: string }> = {
  spot_created: { icon: MapPin, verb: 'Subiste el spot' },
  photo_uploaded: { icon: Camera, verb: 'Subiste una foto a' },
  review_written: { icon: Star, verb: 'Reseñaste' },
  spot_visited: { icon: Footprints, verb: 'Visitaste' },
};

const EmptyState = ({ icon: Icon, title, hint }: { icon: typeof MapPin; title: string; hint: string }) => (
  <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-10 text-center light:bg-white light:border-black">
    <Icon className="w-10 h-10 text-slate-800 mx-auto mb-3 light:text-slate-300" />
    <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">{title}</p>
    <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">{hint}</p>
  </div>
);

export const ActivityList = ({ items, onOpenSpot }: { items: ActivityItem[]; onOpenSpot: (spotId: string) => void }) => {
  if (items.length === 0) {
    return <EmptyState icon={Footprints} title="Sin actividad todavía" hint="Sube un spot, deja una reseña o marca una visita y aparecerá aquí" />;
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const { icon: Icon, verb } = ACTIVITY_LABELS[item.type];
        return (
          <button
            key={item.id}
            onClick={() => item.spot_id && onOpenSpot(item.spot_id)}
            disabled={!item.spot_id}
            className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-800 rounded-2xl text-left disabled:opacity-70 light:bg-white light:border-black"
          >
            <div className="w-9 h-9 rounded-full bg-[#a3ff12]/10 flex items-center justify-center shrink-0 light:bg-[#96ab79]/15">
              <Icon className="w-4 h-4 text-[#a3ff12] light:text-[#96ab79]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-300 light:text-slate-700">
                {verb} <span className="font-bold text-white light:text-black">{item.title}</span>
                {item.rating ? <span className="text-[#a3ff12] font-bold light:text-[#96ab79]"> · {item.rating}★</span> : null}
              </p>
              {item.detail && <p className="text-[10px] text-slate-500 truncate mt-0.5 light:text-slate-600">{item.detail}</p>}
              <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5 light:text-slate-500">{formatRelativeTime(item.createdAt)}</p>
            </div>
            {item.image_url && (
              <img src={item.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" onError={handleImageError} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export const MySpotsList = ({ spots, onOpenSpot }: { spots: Spot[]; onOpenSpot: (spot: Spot) => void }) => {
  if (spots.length === 0) {
    return <EmptyState icon={MapPin} title="Aún no subiste spots" hint="Toca el botón + para compartir tu primer spot con la comunidad" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {spots.map(spot => (
        <button
          key={spot.id}
          onClick={() => onOpenSpot(spot)}
          className="text-left rounded-2xl overflow-hidden bg-slate-900/60 border border-white/5 light:bg-white light:border-black"
        >
          <img
            src={spot.image_url || PLACEHOLDER_IMAGE}
            alt={spot.name}
            className="w-full h-24 object-cover"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
          <div className="p-2 min-w-0">
            <p className="text-xs font-bold text-white truncate light:text-black">{spot.name}</p>
            <p className="text-[10px] text-slate-500 truncate light:text-slate-600">{spot.location_name || 'Spot urbano'}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

export const NotificationsList = ({ items, onOpenSpot }: { items: AppNotification[]; onOpenSpot: (spotId: string) => void }) => {
  if (items.length === 0) {
    return <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás cuando alguien reseñe o suba fotos a los spots que creaste" />;
  }

  return (
    <div className="space-y-2">
      {items.map(n => (
        <button
          key={n.id}
          onClick={() => onOpenSpot(n.spot_id)}
          className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-800 rounded-2xl text-left light:bg-white light:border-black"
        >
          <img
            src={n.actor_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(n.actor)}`}
            alt={n.actor}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 shrink-0 light:border-black"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-300 light:text-slate-700">
              <span className="font-bold text-white light:text-black">{n.actor}</span>{' '}
              {n.type === 'review_on_my_spot' ? 'reseñó' : 'subió una foto a'}{' '}
              <span className="font-bold text-white light:text-black">{n.spot_name}</span>
              {n.rating ? <span className="text-[#a3ff12] font-bold light:text-[#96ab79]"> · {n.rating}★</span> : null}
            </p>
            {n.detail && <p className="text-[10px] text-slate-500 truncate mt-0.5 light:text-slate-600">{n.detail}</p>}
            <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5 light:text-slate-500">{formatRelativeTime(n.createdAt)}</p>
          </div>
          {n.image_url && (
            <img src={n.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" onError={handleImageError} />
          )}
        </button>
      ))}
    </div>
  );
};

export const NotificationsScreen = ({ items, onClose, onOpenSpot }: { items: AppNotification[]; onClose: () => void; onOpenSpot: (spotId: string) => void }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black">
        <ChevronLeft className="w-5 h-5 text-white light:text-black" />
      </button>
      <h2 className={cn('text-lg font-bold text-white light:text-black')}>Notificaciones</h2>
    </div>
    <NotificationsList items={items} onOpenSpot={onOpenSpot} />
  </div>
);
