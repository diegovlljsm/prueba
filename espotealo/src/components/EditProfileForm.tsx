import React from 'react';
import { Camera, ChevronDown, Activity, Bike, Navigation, Layers, Check, Instagram as InstagramIcon } from 'lucide-react';
import { cn, PLACEHOLDER_IMAGE, handleImageError } from '../lib/utils';
import { FirebaseUser, UserProfile } from '../types';
import { AVATAR_OPTIONS, BANNER_OPTIONS } from '../constants';

// Real profile: "Guardar cambios" persists to Firestore via PUT
// /api/users/me (see App.tsx's handleUpdateProfile and server.ts). Name
// is saved here rather than to Firebase Auth's own displayName field, so
// other places in the app that read `user.displayName`/`user.photoURL`
// directly (bottom nav, headers) won't reflect an edit made here yet -
// only this form and the Profile tab's own header do. Account deletion is
// still not implemented (see button below).
const CITIES = ['Santiago', 'Valparaíso', 'Concepción', 'Viña del Mar', 'Otra ciudad'];

const DISCIPLINES = [
  { id: 'skate', label: 'Skate', icon: Activity },
  { id: 'bmx', label: 'BMX', icon: Bike },
  { id: 'parkour', label: 'Parkour', icon: Navigation },
  { id: 'other', label: 'Otro', icon: Layers },
] as const;

// Still mock - no per-user aggregate-stats endpoint yet. Separate concern
// from the profile fields below, which are real as of this pass.
const MOCK_CONTRIBUTION_STATS = { spots: 4, photos: 18 };

interface EditProfileFormProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  onSave: (updates: Partial<Pick<UserProfile, 'displayName' | 'city' | 'discipline' | 'bio' | 'photoURL' | 'bannerURL' | 'instagram'>>) => Promise<UserProfile>;
}

export const EditProfileForm: React.FC<EditProfileFormProps> = ({ user, profile, onSave }) => {
  const [name, setName] = React.useState(profile?.displayName || user?.displayName || 'Rider');
  const [city, setCity] = React.useState(profile?.city || CITIES[0]);
  const [discipline, setDiscipline] = React.useState<typeof DISCIPLINES[number]['id']>(profile?.discipline || 'skate');
  const [bio, setBio] = React.useState(profile?.bio ?? '');
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(profile?.photoURL || user?.photoURL || null);
  // null here just means "no elección propia todavía" - el banner que se
  // ve mientras tanto (BANNER_OPTIONS[0]) es solo un valor de vista previa,
  // igual que el avatar dicebear de arriba; no se guarda hasta que el
  // usuario elige uno explícitamente o presiona Guardar.
  const [bannerPreview, setBannerPreview] = React.useState<string | null>(profile?.bannerURL || null);
  const [instagram, setInstagram] = React.useState(profile?.instagram ?? '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  // profile is fetched async in App.tsx and may not be ready on first
  // render (or this form's first mount) - hydrate the fields once it
  // arrives, but only the first time, so a background refresh (e.g. right
  // after saving) doesn't clobber whatever the user is mid-typing.
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (hydrated.current || !profile) return;
    hydrated.current = true;
    setName(profile.displayName || user?.displayName || 'Rider');
    setCity(profile.city || CITIES[0]);
    if (profile.discipline) setDiscipline(profile.discipline);
    setBio(profile.bio ?? '');
    setPhotoPreview(profile.photoURL || user?.photoURL || null);
    setBannerPreview(profile.bannerURL || null);
    setInstagram(profile.instagram ?? '');
  }, [profile, user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        displayName: name.trim() || undefined,
        city,
        discipline,
        bio,
        photoURL: photoPreview,
        bannerURL: bannerPreview,
        instagram: instagram.trim().replace(/^@+/, ''),
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('No se pudieron guardar los cambios. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Portada</label>
        <button
          onClick={() => bannerInputRef.current?.click()}
          className="relative w-full aspect-[2.4/1] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 group light:bg-white light:border-black"
        >
          <img
            src={bannerPreview || BANNER_OPTIONS[0] || PLACEHOLDER_IMAGE}
            alt="Portada de perfil"
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5">
            <Camera className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">Cambiar portada</span>
          </div>
        </button>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />

        <div className="grid grid-cols-3 gap-2">
          {BANNER_OPTIONS.map(banner => {
            const active = bannerPreview === banner;
            return (
              <button
                key={banner}
                onClick={() => setBannerPreview(banner)}
                className={cn(
                  "relative aspect-[2.4/1] rounded-xl overflow-hidden border-2 transition-colors",
                  active ? "border-[#a3ff12] light:border-[#96ab79]" : "border-transparent"
                )}
              >
                <img src={banner} alt="Opción de portada" className="w-full h-full object-cover" onError={handleImageError} />
                {active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-slate-800 light:bg-black" />

      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-24 h-24 shrink-0 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-[#a3ff12]/40 hover:text-[#a3ff12] transition-colors overflow-hidden light:bg-white light:text-black light:hover:border-[#96ab79] light:hover:text-[#96ab79]"
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Foto</span>
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-lg uppercase truncate light:text-black">{name || 'Rider'}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {MOCK_CONTRIBUTION_STATS.spots} spots · {MOCK_CONTRIBUTION_STATS.photos} fotos
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-bold text-[#a3ff12] mt-2 light:text-[#96ab79]"
          >
            <Camera className="w-3.5 h-3.5" /> Cambiar foto
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">O elige un avatar</label>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_OPTIONS.map(avatar => {
            const active = photoPreview === avatar;
            return (
              <button
                key={avatar}
                onClick={() => setPhotoPreview(avatar)}
                className={cn(
                  "relative aspect-square rounded-full overflow-hidden border-2 transition-colors",
                  active ? "border-[#a3ff12] light:border-[#96ab79]" : "border-transparent"
                )}
              >
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                {active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-slate-800 light:bg-black" />

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Nombre</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white font-semibold focus:outline-none focus:border-[#a3ff12]/40 light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Ciudad</label>
          <div className="relative">
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-slate-800 rounded-xl p-3 pr-10 text-sm text-white font-semibold focus:outline-none focus:border-[#a3ff12]/40 light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none light:text-black" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Instagram</label>
          <div className="relative">
            <InstagramIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 light:text-black" />
            <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none light:text-slate-600">@</span>
            <input
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="tu.usuario"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 pl-16 text-sm text-white font-semibold focus:outline-none focus:border-[#a3ff12]/40 light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
            />
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed px-1 light:text-slate-500">
            Solo tu usuario de Instagram, no es una conexión con tu cuenta - se muestra como enlace en tu perfil.
          </p>
        </div>
      </div>

      <div className="h-px bg-slate-800 light:bg-black" />

      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">Disciplina</label>
        <div className="grid grid-cols-4 gap-2">
          {DISCIPLINES.map(d => {
            const Icon = d.icon;
            const active = discipline === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDiscipline(d.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl border font-semibold text-[10px] uppercase tracking-wide transition-colors",
                  active ? "bg-[#a3ff12] border-[#a3ff12] text-black light:bg-[#96ab79] light:border-[#96ab79] light:text-white" : "bg-slate-900 border-slate-800 text-slate-400 light:bg-white light:border-black light:text-black"
                )}
              >
                <Icon className="w-4 h-4" />
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 light:text-black">
          Bio · {bio.length}/140
        </label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, 140))}
          maxLength={140}
          rows={3}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:border-[#a3ff12]/40 light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-[#a3ff12] text-black font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60 light:bg-[#96ab79] light:text-white"
      >
        {isSaving ? 'Guardando...' : justSaved ? '¡Guardado!' : 'Guardar cambios'}
      </button>

      <div className="h-px bg-slate-800 light:bg-black" />

      <div className="space-y-2">
        <button
          onClick={() => { if (window.confirm('¿Eliminar tu cuenta? Esta acción no se puede deshacer.')) alert('Próximamente: eliminar cuenta.'); }}
          className="w-full border border-rose-500/30 bg-rose-500/5 text-rose-500 font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-all light:bg-white light:border-black light:text-black"
        >
          Eliminar mi cuenta
        </button>
        <p className="text-xs text-slate-500 leading-relaxed px-1 light:text-slate-600">
          Los spots que subiste se quedan en el mapa, sin tu nombre.
        </p>
      </div>
    </div>
  );
};
