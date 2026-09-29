import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Navigation, Check, Camera, Mountain, TriangleAlert, Soup, Atom } from 'lucide-react';
import { cn } from '../lib/utils';
import { Spot, SPOT_FEATURES } from '../types';
import { CATEGORIES } from '../constants';

const SPOT_TYPES = [
  { id: 'street', label: 'Street', icon: Mountain },
  { id: 'park', label: 'Park', icon: TriangleAlert },
  { id: 'bowl', label: 'Bowl', icon: Soup },
  { id: 'diy', label: 'DIY', icon: Atom },
] as const;

const STEP_LABELS: Record<number, string> = {
  1: 'Ubicación',
  2: 'Qué hay ahí',
  3: 'Detalles finales',
};

interface AddSpotFormProps {
  onClose: () => void;
  onSubmit: (spotData: Partial<Spot>) => Promise<void>;
  newSpotCoords: { lat: number, lng: number } | null;
  setNewSpotCoords: (coords: { lat: number, lng: number } | null) => void;
  geocodingLib: any;
  map: any;
  setIsOverlayMinimized: (minimized: boolean) => void;
}

// 3-step wizard (Ubicación / Qué hay ahí / Detalles finales) instead of one
// long form - the old single-page version had 14 fields on screen at once.
// Fields are held in controlled state (not read from FormData on submit
// anymore) so values survive moving back and forth between steps.
export const AddSpotForm: React.FC<AddSpotFormProps> = ({
  onClose,
  onSubmit,
  newSpotCoords,
  setNewSpotCoords,
  geocodingLib,
  map,
  setIsOverlayMinimized
}) => {
  const [step, setStep] = useState(1);
  const [addressSearch, setAddressSearch] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Step 2 - Qué hay ahí
  const [name, setName] = useState('');
  const [spotType, setSpotType] = useState<Spot['spot_type'] | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  // El servidor exige al menos una categoría (spotCategoryField en
  // serverSchemas.ts), por eso el toggle de abajo nunca deja la lista vacía.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([CATEGORIES[0].id]);

  // Step 3 - Detalles finales
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [openHours, setOpenHours] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advances past step 1 the moment a location is fixed, whether that
  // happened via the address search below or by tapping the map directly
  // (which sets newSpotCoords from outside this component).
  useEffect(() => {
    if (newSpotCoords && step === 1) setStep(2);
  }, [newSpotCoords, step]);

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

  const goBack = () => {
    if (step === 2) {
      setNewSpotCoords(null);
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const goNext = () => {
    if (!name.trim()) {
      alert('Ponle un nombre al spot antes de continuar.');
      return;
    }
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!newSpotCoords) return;
    const spotData: Partial<Spot> = {
      name: name.trim() || 'Nuevo Spot',
      description: description.trim(),
      lat: newSpotCoords.lat,
      lng: newSpotCoords.lng,
      category: JSON.stringify(selectedCategories),
      image_url: selectedImage || undefined,
      location_name: locationName.trim() || undefined,
      open_hours: openHours.trim() || undefined,
      spot_type: spotType || undefined,
      features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(spotData);
    } catch (err: any) {
      console.error('Submit error:', err);
      alert(`Error al crear el spot: ${err?.message || 'Revisa los campos e intenta nuevamente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="light:text-black"><X className="w-6 h-6" /></button>
        <h2 className="text-sm font-bold uppercase tracking-widest light:text-black">Nuevo Spot</h2>
        <div className="w-6" />
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                s <= step ? "bg-[#a3ff12] light:bg-[#96ab79]" : "bg-slate-800 light:bg-slate-200"
              )}
            />
          ))}
        </div>
        <p className="text-[10px] uppercase font-mono text-slate-500 tracking-widest light:text-slate-600">
          Paso {step} de 3 · {STEP_LABELS[step]}
        </p>
      </div>

      <div className="h-px bg-slate-800 light:bg-black" />

      {step === 1 && (
        <div className="space-y-4">
          <form onSubmit={handleAddressSearch} className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Busca la dirección</label>
            <div className="relative">
              <input
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 pl-10 text-sm focus:outline-none focus:border-emerald-500 light:bg-white light:border-black light:focus:border-[#96ab79]"
                placeholder="Calle, ciudad o lugar..."
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
              <button
                type="submit"
                disabled={isSearchingAddress}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-slate-950 p-1.5 rounded-lg md:hover:bg-emerald-400 transition-colors disabled:opacity-50 light:bg-[#96ab79] light:text-white"
              >
                {isSearchingAddress ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin light:border-white" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => setIsOverlayMinimized(true)}
            className="w-full p-6 bg-slate-800/50 border border-slate-700 border-dashed rounded-2xl text-center md:hover:bg-slate-800 transition-colors group light:bg-white light:border-[#96ab79]"
          >
            <p className="text-xs text-slate-500 mb-2 md:group-hover:text-slate-400 light:text-black light:md:group-hover:text-slate-600">O si prefieres...</p>
            <p className="text-sm text-slate-300 md:group-hover:text-emerald-400 transition-colors light:text-[#96ab79]">Toca directamente el mapa para fijar el punto exacto.</p>
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 light:bg-white light:border-black">
            <div className="bg-emerald-500 p-1.5 rounded-lg light:bg-[#96ab79]">
              <Check className="w-4 h-4 text-slate-950 light:text-white" />
            </div>
            <p className="text-[10px] uppercase font-mono text-emerald-500 font-semibold light:text-black">Ubicación fijada</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest light:text-black">Nombre del spot</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1a1f14] border-2 border-[#a3ff12]/20 rounded-[24px] p-4 text-lg font-semibold text-white focus:outline-none focus:border-[#a3ff12] transition-colors light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
              placeholder="ej. Ledges de Irarrázaval"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Disciplina (Selección Múltiple)</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategories(prev =>
                      active
                        ? (prev.length > 1 ? prev.filter(c => c !== cat.id) : prev)
                        : [...prev, cat.id]
                    )}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-1 min-w-0 rounded-xl border transition-all",
                      active ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800 border-slate-700 text-slate-400 md:hover:border-slate-600 light:bg-white light:border-black light:text-black"
                    )}
                  >
                    {cat.icon}
                    <span className="text-[10px] font-semibold max-w-full truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Tipo de spot</label>
            <div className="grid grid-cols-4 gap-2">
              {SPOT_TYPES.map(t => {
                const Icon = t.icon;
                const active = spotType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSpotType(active ? null : t.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                      active ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800 border-slate-700 text-slate-400 md:hover:border-slate-600 light:bg-white light:border-black light:text-black"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Características (Selección Múltiple)</label>
            <div className="flex flex-wrap gap-2">
              {SPOT_FEATURES.map(f => {
                const active = selectedFeatures.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFeatures(prev => active ? prev.filter(x => x !== f) : [...prev, f])}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs font-semibold transition-all",
                      active ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-800 border-slate-700 text-slate-400 md:hover:border-slate-600 light:bg-white light:border-black light:text-black"
                    )}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          {/* Photo Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative rounded-[40px] overflow-hidden aspect-[4/3] bg-[#1a1f14] border border-dashed border-[#a3ff12]/20 cursor-pointer group shadow-2xl light:bg-white light:shadow-none"
          >
            {selectedImage ? (
              <img src={selectedImage} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 light:bg-black/5">
                <div className="w-20 h-20 bg-[#a3ff12] rounded-full flex items-center justify-center shadow-xl shadow-[#a3ff12]/20 md:group-hover:scale-110 transition-transform light:bg-[#96ab79] light:shadow-none">
                  <Camera className="w-10 h-10 text-black light:text-white" />
                </div>
                <p className="text-sm font-bold text-white uppercase tracking-widest light:text-black">Toca para subir una foto</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Ubicación (Nombre legible)</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 light:bg-white light:border-black light:focus:border-[#96ab79]"
              placeholder="ej. Santiago, Chile"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Horario (Opcional)</label>
            <input
              value={openHours}
              onChange={(e) => setOpenHours(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 light:bg-white light:border-black light:focus:border-[#96ab79]"
              placeholder="ej. Lunes a Domingo, 7:00 AM - 9:00 PM"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 h-20 light:bg-white light:border-black light:focus:border-[#96ab79]"
              placeholder="¿Cómo es el lugar? ¿Bordes, barandas, escaleras?"
            />
          </div>
        </div>
      )}

      {step > 1 && (
        <>
          <div className="h-px bg-slate-800 light:bg-black" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-semibold text-sm transition-all active:scale-[0.98] light:border-black light:text-black light:bg-white"
            >
              Atrás
            </button>
            {step === 2 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 bg-emerald-500 md:hover:bg-emerald-400 text-slate-950 font-semibold py-3 rounded-xl transition-colors light:bg-[#96ab79] light:hover:bg-[#96ab79] light:text-white"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-500 md:hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 light:bg-[#96ab79] light:hover:bg-[#96ab79] light:text-white"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin light:border-white" />
                    <span>GUARDANDO...</span>
                  </>
                ) : (
                  <span>CREAR SPOT</span>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};
