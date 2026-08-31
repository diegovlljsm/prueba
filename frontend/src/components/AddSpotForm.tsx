import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Info, MapPin, Navigation, Check, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { Spot, Category } from '../types';
import { CATEGORIES } from '../constants';

interface AddSpotFormProps {
  onClose: () => void;
  onSubmit: (spotData: Partial<Spot>) => Promise<void>;
  newSpotCoords: { lat: number, lng: number } | null;
  setNewSpotCoords: (coords: { lat: number, lng: number } | null) => void;
  geocodingLib: any;
  map: any;
  setIsOverlayMinimized: (minimized: boolean) => void;
}

export const AddSpotForm: React.FC<AddSpotFormProps> = ({
  onClose,
  onSubmit,
  newSpotCoords,
  setNewSpotCoords,
  geocodingLib,
  map,
  setIsOverlayMinimized
}) => {
  const [addressSearch, setAddressSearch] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [markerColor, setMarkerColor] = useState('#a3ff12');
  const [showLabelOnMap, setShowLabelOnMap] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressSearch.trim()) return;
    
    setIsSearchingAddress(true);
    try {
      if (!geocodingLib) {
        alert('El servicio de mapas aún se está cargando. Por favor, espera un momento.');
        setIsSearchingAddress(false);
        return;
      }
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ address: addressSearch }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const { lat, lng } = results[0].geometry.location;
          const coords = { lat: lat(), lng: lng() };
          setNewSpotCoords(coords);
          if (map) {
            map.panTo(coords);
            map.setZoom(17);
          }
        } else {
          alert('No se pudo encontrar la dirección. Intenta ser más específico o marca el mapa manualmente.');
        }
        setIsSearchingAddress(false);
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      setIsSearchingAddress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSpotCoords) return;
    const formData = new FormData(e.currentTarget);
    const spotData: Partial<Spot> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      lat: newSpotCoords.lat,
      lng: newSpotCoords.lng,
      category: JSON.stringify(selectedCategories),
      marker_color: markerColor,
      show_label: showLabelOnMap,
      image_url: selectedImage || (formData.get('image_url') as string),
      location_name: formData.get('location_name') as string,
      floor_quality: formData.get('floor_quality') as string,
      obstacles: formData.get('obstacles') as string,
    };

    await onSubmit(spotData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <button onClick={onClose}><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">Add New Spot</h2>
        <button className="p-1 bg-[#a3ff12] rounded-full">
          <Info className="w-5 h-5 text-black" />
        </button>
      </div>

      {!newSpotCoords ? (
        <div className="space-y-4">
          <form onSubmit={handleAddressSearch} className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500">Paso 1: Busca la dirección</label>
            <div className="relative">
              <input 
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 pl-10 text-sm focus:outline-none focus:border-emerald-500" 
                placeholder="Calle, ciudad o lugar..." 
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <button 
                type="submit"
                disabled={isSearchingAddress}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-slate-950 p-1.5 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                {isSearchingAddress ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>

          <button 
            type="button"
            onClick={() => setIsOverlayMinimized(true)}
            className="w-full p-6 bg-slate-800/50 border border-slate-700 border-dashed rounded-2xl text-center hover:bg-slate-800 transition-colors group"
          >
            <p className="text-xs text-slate-500 mb-2 group-hover:text-slate-400">O si prefieres...</p>
            <p className="text-sm text-slate-300 group-hover:text-emerald-400 transition-colors">Toca directamente el mapa para fijar el punto exacto.</p>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
            <div className="bg-emerald-500 p-1.5 rounded-lg">
              <Check className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono text-emerald-500 font-bold">Ubicación fijada</p>
              <button 
                type="button"
                onClick={() => setNewSpotCoords(null)}
                className="text-xs text-slate-400 underline"
              >
                Cambiar ubicación
              </button>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <div 
              onClick={() => document.getElementById('spot-photo-upload')?.click()}
              className="relative rounded-[40px] overflow-hidden aspect-[4/3] bg-[#1a1f14] border border-dashed border-[#a3ff12]/20 cursor-pointer group shadow-2xl"
            >
              {selectedImage ? (
                <img src={selectedImage} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40">
                  <div className="w-20 h-20 bg-[#a3ff12] rounded-full flex items-center justify-center shadow-xl shadow-[#a3ff12]/20 group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10 text-black" />
                  </div>
                  <p className="text-sm font-black text-white uppercase tracking-widest">TAP TO UPLOAD PHOTO</p>
                </div>
              )}
              <input 
                id="spot-photo-upload"
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">SPOT NAME</label>
            <input 
              name="name" 
              required 
              className="w-full bg-[#1a1f14] border-2 border-[#a3ff12]/20 rounded-[24px] p-4 text-lg font-bold text-white focus:outline-none focus:border-[#a3ff12] transition-colors" 
              placeholder="e.g. Concrete Waves Ledge" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500">Ubicación (Nombre legible)</label>
            <input name="location_name" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="ej. Santiago, Chile" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-500">Calidad del Suelo</label>
              <select name="floor_quality" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500">
                <option value="Smooth Concrete">Concreto Suave</option>
                <option value="Rough Asphalt">Asfalto Rugoso</option>
                <option value="Tiles">Baldosas</option>
                <option value="Wood">Madera</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-500">Obstáculos</label>
              <input name="obstacles" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="ej. Rails, Stairs" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500">URL de Imagen (Opcional)</label>
            <input name="image_url" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500">Deportes (Selección Múltiple)</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategories(prev => 
                      prev.includes(c.id) 
                        ? prev.filter(id => id !== c.id)
                        : [...prev, c.id]
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-xs transition-all",
                    selectedCategories.includes(c.id)
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  )}
                >
                  {c.icon}
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-500">Color del Marcador</label>
              <div className="flex gap-2">
                {['#a3ff12', '#6366f1', '#f43f5e', '#f59e0b', '#ffffff'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setMarkerColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-transform",
                      markerColor === color ? "scale-125 border-white" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-slate-500">Etiqueta en Mapa</label>
              <button
                type="button"
                onClick={() => setShowLabelOnMap(!showLabelOnMap)}
                className={cn(
                  "w-full py-2 rounded-lg border text-xs font-bold transition-all",
                  showLabelOnMap 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                    : "bg-slate-800 border-slate-700 text-slate-500"
                )}
              >
                {showLabelOnMap ? 'MOSTRAR NOMBRE' : 'OCULTO'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500">Descripción</label>
            <textarea name="description" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 h-20" placeholder="¿Cómo es el lugar? ¿Bordes, barandas, escaleras?" />
          </div>
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-colors">
            CREAR SPOT
          </button>
        </form>
      )}
    </motion.div>
  );
};
