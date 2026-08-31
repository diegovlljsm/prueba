import React from 'react';
import { motion } from 'motion/react';
import { X, Calendar, MapPin, Navigation } from 'lucide-react';
import { UrbanEvent } from '../types';

interface EventDetailProps {
  event: UrbanEvent;
  onClose: () => void;
}

export const EventDetail = ({ event, onClose }: EventDetailProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <button 
        onClick={onClose}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" /> Volver
      </button>
      
      <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{event.title}</h2>
            <p className="text-xs text-indigo-400 font-mono uppercase">{event.category}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="w-4 h-4 text-slate-500" />
            {event.location_name}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-slate-500" />
            {new Date(event.date).toLocaleString('es-ES', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed border-t border-indigo-500/10 pt-4">
          {event.description}
        </p>

        <button 
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`, '_blank')}
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Navigation className="w-4 h-4" /> CÓMO LLEGAR
        </button>
      </div>
    </motion.div>
  );
};
