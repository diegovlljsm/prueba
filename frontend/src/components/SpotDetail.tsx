import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Navigation, Share2, Star, Trash2, Video, Plus, Check, X } from 'lucide-react';
import { Spot, VideoClip } from '../types';

interface SpotDetailProps {
  spot: Spot;
  videos: VideoClip[];
  onClose: () => void;
  onUpload: () => void;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  /** Traza la ruta hasta el spot. Opcional: sin ubicación del usuario no se ofrece. */
  onComoLlegar?: (spot: Spot) => void;
  /** Distancia ya formateada desde el usuario, si la sabemos. */
  distancia?: string | null;
}

export const SpotDetail = ({ spot, videos, onClose, onUpload, isAdmin, onDelete, onComoLlegar, distancia }: SpotDetailProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-10"
    >
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between mb-4 bg-slate-900/80 backdrop-blur-md z-10 py-2">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Spot Detail</h2>
        <button className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform">
          <Share2 className="w-6 h-6 text-[#baf413]" />
        </button>
      </div>

      {/* Desktop Header */}
      <button 
        onClick={onClose}
        className="hidden md:flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Volver a la lista
      </button>

      {/* Main Image */}
      <div className="relative rounded-[32px] overflow-hidden aspect-[4/3] mb-8 shadow-2xl group">
        <img 
          src={spot.image_url || `https://images.unsplash.com/photo-1520156584189-1ee29241274c?auto=format&fit=crop&q=80&w=800`} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          alt={spot.name}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 bg-[#baf413] text-black text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-[#baf413]/20">
          ACTIVE NOW
        </div>
        <button className="absolute bottom-6 right-6 p-4 bg-[#baf413] rounded-full text-black shadow-xl active:scale-90 transition-all hover:rotate-12">
          <Star className="w-6 h-6 fill-black" />
        </button>
      </div>

      {/* Title & Location */}
      <div className="space-y-2 relative">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl md:text-3xl lg:text-5xl font-black text-white leading-tight tracking-tighter flex-1">{spot.name}</h1>
          {isAdmin && (
            <button 
              onClick={() => onDelete(spot.id)}
              className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-colors shrink-0"
              title="Eliminar Spot"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[#baf413]">
          <div className="w-2 h-2 bg-[#baf413] rounded-full animate-pulse" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80">{spot.location_name || 'Ubicación desconocida'}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Suelo</p>
          <p className="text-sm font-bold text-white">{spot.floor_quality || 'N/A'}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Obstáculos</p>
          <p className="text-sm font-bold text-white">{spot.obstacles || 'N/A'}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Categoría</p>
          <p className="text-sm font-bold text-white capitalize">{spot.category}</p>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
        <p className="text-slate-300 leading-relaxed text-sm italic">
          "{spot.description}"
        </p>
      </div>

      {/* Cómo llegar: la acción principal de la ficha en la maqueta. */}
      {onComoLlegar && (
        <button
          onClick={() => onComoLlegar(spot)}
          className="w-full flex items-center justify-center gap-2 bg-[#baf413] text-black font-black py-4 rounded-full shadow-lg shadow-[#baf413]/20 active:scale-95 transition-all"
        >
          <Navigation className="w-5 h-5" />
          Cómo llegar{distancia ? ` · ${distancia}` : ''}
        </button>
      )}

      {/* Video Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Video className="w-5 h-5 text-[#baf413]" /> CLIPS <span className="text-slate-500 text-sm">({videos.length})</span>
          </h3>
          <button 
            onClick={onUpload}
            className="bg-[#baf413] text-black px-4 py-2 rounded-full text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[#baf413]/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> SUBIR CLIP
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center">
            <Video className="w-12 h-12 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay clips aún</p>
            <p className="text-slate-600 text-[10px] mt-1">Sé el primero en grabar este spot</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {videos.map(video => (
              <div key={video.id} className="group relative bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 shadow-xl">
                <video 
                  src={video.video_url} 
                  className="w-full aspect-video object-cover"
                  controls
                />
                <div className="p-4 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#baf413] rounded-full flex items-center justify-center text-black font-black text-[10px]">
                      {video.user_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{video.user_name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Verified Skater</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-500 hover:text-white transition-colors"><Check className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
