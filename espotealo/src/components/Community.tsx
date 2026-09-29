import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Bookmark, Trash2, X, Send, Camera, MapPin, ChevronLeft } from 'lucide-react';
import { CommunityPost, PostComment, Spot, PublicProfile } from '../types';
import { cn, PLACEHOLDER_IMAGE, handleImageError, formatRelativeTime } from '../lib/utils';

// Comunidad real (antes era una maqueta con posts fijos). Estos tres
// componentes los montan tanto MobileLayout como DesktopLayout, igual que
// SpotDetail/EventDetail: la ventana la abre cada layout con su propio
// contenedor, el contenido se comparte para no divergir.

const Avatar = ({ src, name, size = 'w-9 h-9' }: { src: string | null; name: string; size?: string }) => (
  <img
    src={src || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`}
    alt={name}
    referrerPolicy="no-referrer"
    className={cn(size, 'rounded-full bg-slate-800 border border-white/10 object-cover shrink-0 light:border-black')}
  />
);

interface PostCardProps {
  post: CommunityPost;
  onToggleLike: (postId: string) => void;
  onOpen: (post: CommunityPost) => void;
  onOpenAuthor: (uid: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onToggleLike, onOpen, onOpenAuthor }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <button onClick={() => onOpenAuthor(post.createdBy)} className="flex items-center gap-3 min-w-0 text-left">
        <Avatar src={post.user_avatar} name={post.user_name} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate light:text-black">{post.user_name}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider light:text-slate-600">
            {formatRelativeTime(post.createdAt)}
          </p>
        </div>
      </button>
    </div>

    <button onClick={() => onOpen(post)} className="block w-full rounded-[28px] overflow-hidden aspect-square bg-slate-900">
      <img
        src={post.image_url || PLACEHOLDER_IMAGE}
        alt={post.caption || 'Publicación'}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </button>

    <div className="flex items-center gap-5">
      <button onClick={() => onToggleLike(post.id)} className="flex items-center gap-2 active:scale-90 transition-all">
        <Heart className={cn('w-6 h-6 transition-colors', post.likedByMe ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : 'text-white light:text-black')} />
        <span className="text-sm font-semibold text-white light:text-black">{post.likeCount}</span>
      </button>
      <button onClick={() => onOpen(post)} className="flex items-center gap-2 active:scale-90 transition-all">
        <MessageCircle className="w-6 h-6 text-white light:text-black" />
        <span className="text-sm font-semibold text-white light:text-black">{post.commentCount}</span>
      </button>
    </div>

    {post.caption && (
      <p className="text-sm text-slate-200 leading-relaxed light:text-slate-800">
        <span className="font-bold text-white light:text-black">{post.user_name}</span> {post.caption}
      </p>
    )}

    {post.tags.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {post.tags.map(tag => (
          <span key={tag} className="text-sm text-[#a3ff12] font-semibold tracking-tight light:text-[#96ab79]">#{tag}</span>
        ))}
      </div>
    )}

    {post.commentCount > 0 && (
      <button onClick={() => onOpen(post)} className="text-xs text-slate-500 font-semibold uppercase tracking-widest hover:text-slate-400 transition-colors light:text-slate-600">
        Ver los {post.commentCount} comentarios
      </button>
    )}
  </div>
);

interface PostComposerProps {
  spots: Spot[];
  onSubmit: (post: { image_url: string; caption?: string; tags?: string[]; spot_id?: string | null }) => Promise<void>;
  onClose: () => void;
}

export const PostComposer = ({ spots, onSubmit, onClose }: PostComposerProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [spotId, setSpotId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Los hashtags salen del propio texto: se escriben como en cualquier red
  // social en vez de pedir un campo aparte. El servidor los normaliza.
  const tags: string[] = Array.from(new Set((caption.match(/#[\wáéíóúñü]+/gi) || []).map((t: string) => t.slice(1).toLowerCase())));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ image_url: image, caption: caption.trim(), tags, spot_id: spotId || null });
    } catch (err) {
      console.error('Error creating post:', err);
      alert('No se pudo publicar. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white light:text-black">Nueva publicación</h2>
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black">
          <X className="w-5 h-5 text-white light:text-black" />
        </button>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className="relative rounded-[32px] overflow-hidden aspect-square bg-[#1a1f14] border border-dashed border-[#a3ff12]/20 cursor-pointer group light:bg-white light:border-black"
      >
        {image ? (
          <img src={image} className="w-full h-full object-cover" alt="Vista previa" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 bg-[#a3ff12] rounded-full flex items-center justify-center md:group-hover:scale-110 transition-transform light:bg-[#96ab79]">
              <Camera className="w-10 h-10 text-black light:text-white" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-widest light:text-black">Toca para elegir una foto</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Descripción</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={500}
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-sm text-white h-24 focus:outline-none focus:border-[#a3ff12] light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
          placeholder="Cuenta cómo estuvo la sesión. Usa #hashtags para que te encuentren."
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <span key={t} className="text-xs text-[#a3ff12] font-semibold light:text-[#96ab79]">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase font-mono text-slate-500 light:text-black">Spot (opcional)</label>
        <select
          value={spotId}
          onChange={(e) => setSpotId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-sm text-white focus:outline-none focus:border-[#a3ff12] light:bg-white light:border-black light:text-black"
        >
          <option value="">Sin spot</option>
          {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!image || isSubmitting}
        className="w-full bg-[#a3ff12] disabled:opacity-40 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all light:bg-[#96ab79] light:text-white"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin light:border-white" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        PUBLICAR
      </button>
    </div>
  );
};

interface PostDetailProps {
  post: CommunityPost;
  comments: PostComment[];
  currentUid: string | null;
  onClose: () => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (text: string) => Promise<void>;
  onDelete: (postId: string) => void;
  onOpenAuthor: (uid: string) => void;
}

export const PostDetail = ({
  post, comments, currentUid, onClose, onToggleLike, onAddComment, onDelete, onOpenAuthor,
}: PostDetailProps) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setIsSending(true);
    try {
      await onAddComment(value);
      setText('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black">
          <ChevronLeft className="w-5 h-5 text-white light:text-black" />
        </button>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 light:text-black">Publicación</h2>
        {post.createdBy === currentUid ? (
          <button
            onClick={() => { if (window.confirm('¿Borrar esta publicación?')) onDelete(post.id); }}
            className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black"
          >
            <Trash2 className="w-5 h-5 text-rose-400" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <button onClick={() => onOpenAuthor(post.createdBy)} className="flex items-center gap-3 min-w-0 w-full text-left">
        <Avatar src={post.user_avatar} name={post.user_name} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate light:text-black">{post.user_name}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider light:text-slate-600">{formatRelativeTime(post.createdAt)}</p>
        </div>
      </button>

      <div className="rounded-[28px] overflow-hidden aspect-square bg-slate-900">
        <img
          src={post.image_url || PLACEHOLDER_IMAGE}
          alt={post.caption || 'Publicación'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
      </div>

      <div className="flex items-center gap-5">
        <button onClick={() => onToggleLike(post.id)} className="flex items-center gap-2 active:scale-90 transition-all">
          <Heart className={cn('w-6 h-6 transition-colors', post.likedByMe ? 'text-[#a3ff12] fill-[#a3ff12] light:text-[#96ab79] light:fill-[#96ab79]' : 'text-white light:text-black')} />
          <span className="text-sm font-semibold text-white light:text-black">{post.likeCount}</span>
        </button>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-white light:text-black" />
          <span className="text-sm font-semibold text-white light:text-black">{comments.length}</span>
        </div>
      </div>

      {post.caption && (
        <p className="text-sm text-slate-200 leading-relaxed light:text-slate-800">
          <span className="font-bold text-white light:text-black">{post.user_name}</span> {post.caption}
        </p>
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest light:text-black">Comentarios</h3>
        {comments.length === 0 ? (
          <p className="text-xs text-slate-600 light:text-slate-500">Todavía no hay comentarios. Sé el primero.</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <Avatar src={c.user_avatar} name={c.user_name} size="w-8 h-8" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 leading-relaxed light:text-slate-800">
                  <span className="font-bold text-white light:text-black">{c.user_name}</span> {c.text}
                </p>
                <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5 light:text-slate-500">{formatRelativeTime(c.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          maxLength={500}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-full px-4 h-11 text-sm text-white focus:outline-none focus:border-[#a3ff12] light:bg-white light:border-black light:text-black light:focus:border-[#96ab79]"
          placeholder="Escribe un comentario..."
        />
        <button
          onClick={send}
          disabled={!text.trim() || isSending}
          className="shrink-0 w-11 h-11 rounded-full bg-[#a3ff12] disabled:opacity-40 flex items-center justify-center active:scale-90 transition-all light:bg-[#96ab79]"
        >
          <Send className="w-4 h-4 text-black light:text-white" />
        </button>
      </div>
    </div>
  );
};

export const StoriesRow = ({ posts, onOpen, onCreate }: { posts: CommunityPost[]; onOpen: (post: CommunityPost) => void; onCreate: () => void }) => {
  // "Historias" = publicaciones de las últimas 24 h, una por rider. No es un
  // subsistema aparte con contenido efímero propio: reutiliza el feed real,
  // así que nunca muestra un círculo que no lleve a nada.
  const cutoff = Date.now() - 86400000;
  const recent = posts.filter(p => {
    const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    return t >= cutoff;
  });
  const byRider = new Map<string, CommunityPost>();
  for (const p of recent) if (!byRider.has(p.createdBy)) byRider.set(p.createdBy, p);
  const stories = Array.from(byRider.values());

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
      <button onClick={onCreate} className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#a3ff12] flex items-center justify-center light:border-[#96ab79]">
          <Camera className="w-6 h-6 text-[#a3ff12] light:text-[#96ab79]" />
        </div>
        <span className="text-[10px] text-slate-400 font-semibold light:text-slate-600">Publicar</span>
      </button>
      {stories.map(p => (
        <button key={p.id} onClick={() => onOpen(p)} className="flex flex-col items-center gap-2 flex-shrink-0 max-w-[72px]">
          <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#a3ff12] to-[#ff7a1a] light:from-[#96ab79] light:to-[#d97e3f]">
            <img
              src={p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.user_name)}`}
              alt={p.user_name}
              referrerPolicy="no-referrer"
              className="w-full h-full rounded-full object-cover border-2 border-slate-950 light:border-white"
            />
          </div>
          <span className="text-[10px] text-slate-400 font-semibold truncate max-w-full light:text-slate-600">{p.user_name}</span>
        </button>
      ))}
    </div>
  );
};

interface PublicProfileViewProps {
  profile: PublicProfile;
  onClose: () => void;
  onOpenSpot: (spot: Spot) => void;
  onOpenPost: (post: CommunityPost) => void;
}

export const PublicProfileView = ({ profile, onClose, onOpenSpot, onOpenPost }: PublicProfileViewProps) => (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-transform light:bg-white light:border light:border-black">
        <ChevronLeft className="w-5 h-5 text-white light:text-black" />
      </button>
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 light:text-black">Perfil</h2>
      <div className="w-9" />
    </div>

    <div className="relative">
      <div className="h-28 rounded-[28px] overflow-hidden bg-slate-800 light:bg-slate-200">
        {profile.bannerURL && <img src={profile.bannerURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
      </div>
      <div className="absolute -bottom-8 left-6">
        <Avatar src={profile.photoURL} name={profile.displayName || 'Rider'} size="w-20 h-20" />
      </div>
    </div>

    <div className="pt-8 space-y-1">
      <h3 className="text-2xl font-bold text-white tracking-tight light:text-black">{profile.displayName || 'Rider'}</h3>
      {profile.city && (
        <div className="flex items-center gap-1.5 text-slate-400 light:text-slate-600">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">{profile.city}</span>
        </div>
      )}
      {profile.bio && <p className="text-sm text-slate-300 leading-relaxed light:text-slate-700">{profile.bio}</p>}
      {profile.instagram && (
        <a
          href={`https://instagram.com/${profile.instagram}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-semibold text-[#a3ff12] light:text-[#96ab79]"
        >
          @{profile.instagram}
        </a>
      )}
    </div>

    <div className="grid grid-cols-3 bg-slate-800/50 border border-slate-800 rounded-2xl py-3 light:bg-white light:border-black">
      <div className="text-center border-r border-slate-800 light:border-black">
        <p className="text-xl font-bold text-white light:text-black">{profile.spotsCreated}</p>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Spots</p>
      </div>
      <div className="text-center border-r border-slate-800 light:border-black">
        <p className="text-xl font-bold text-white light:text-black">{profile.postsCount}</p>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Publicaciones</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-white light:text-black">{profile.reviewsWritten}</p>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5 light:text-slate-600">Reseñas</p>
      </div>
    </div>

    {profile.spots.length > 0 && (
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest light:text-black">Spots que subió</h4>
        <div className="grid grid-cols-2 gap-3">
          {profile.spots.map(s => (
            <button key={s.id} onClick={() => onOpenSpot(s)} className="text-left rounded-2xl overflow-hidden bg-slate-900/60 border border-white/5 light:bg-white light:border-black">
              <img src={s.image_url || PLACEHOLDER_IMAGE} alt={s.name} className="w-full h-24 object-cover" referrerPolicy="no-referrer" onError={handleImageError} />
              <p className="text-xs font-bold text-white truncate p-2 light:text-black">{s.name}</p>
            </button>
          ))}
        </div>
      </div>
    )}

    {profile.posts.length > 0 && (
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest light:text-black">Publicaciones</h4>
        <div className="grid grid-cols-3 gap-2">
          {profile.posts.map(p => (
            <button key={p.id} onClick={() => onOpenPost(p)} className="aspect-square rounded-xl overflow-hidden bg-slate-900">
              <img src={p.image_url || PLACEHOLDER_IMAGE} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={handleImageError} />
            </button>
          ))}
        </div>
      </div>
    )}

    {profile.spots.length === 0 && profile.posts.length === 0 && (
      <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-[32px] p-10 text-center light:bg-white light:border-black">
        <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs light:text-black">Sin aportes todavía</p>
        <p className="text-slate-600 text-[10px] mt-1 light:text-slate-500">Este rider aún no ha subido spots ni publicaciones</p>
      </div>
    )}
  </div>
);

export const AnimatedSheet = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
  <AnimatePresence>
    {show && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);
