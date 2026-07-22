import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Music, Search, Plus, Loader2, Check, Filter, Youtube, ExternalLink, Clock, Tag, ShieldCheck, Play, AlertCircle } from "lucide-react";
import { SCROLL_FADE_STYLE } from "@/lib/utils";

import { motion, AnimatePresence } from "framer-motion";
const AP = AnimatePresence;
const m = motion;

const GlobalSongEntity = base44.entities.GlobalSong;

const ARTIST_COLORS = {
  "Bethel Music": "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Elevation Worship": "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "Maverick City Music": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "Hillsong Worship": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "Hillsong UNITED": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "Passion": "bg-red-500/15 text-red-300 border-red-500/25",
  "Jesus Culture": "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "Phil Wickham": "bg-green-500/15 text-green-300 border-green-500/25",
  "Brandon Lake": "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  "Kari Jobe": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "Chris Tomlin": "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  "UPPERROOM": "bg-violet-500/15 text-violet-300 border-violet-500/25",
  "Red Rocks Worship": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "Cory Asbury": "bg-teal-500/15 text-teal-300 border-teal-500/25",
  "Pat Barrett": "bg-lime-500/15 text-lime-300 border-lime-500/25",
  "Leeland": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  "Cody Carnes": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "Rend Collective": "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
  "All Sons & Daughters": "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

const KEY_COLORS = {
  "C": "bg-red-500/10 text-red-300 border-red-500/20",
  "C#": "bg-orange-500/10 text-orange-300 border-orange-500/20",
  "D": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "Eb": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  "E": "bg-lime-500/10 text-lime-300 border-lime-500/20",
  "F": "bg-green-500/10 text-green-300 border-green-500/20",
  "F#": "bg-teal-500/10 text-teal-300 border-teal-500/20",
  "G": "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  "Ab": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  "A": "bg-blue-500/10 text-blue-300 border-blue-500/20",
  "Bb": "bg-violet-500/10 text-violet-300 border-violet-500/20",
  "B": "bg-purple-500/10 text-purple-300 border-purple-500/20",
};

const KEYS = ["All", "A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab"];

const SORT_OPTIONS = [
  { id: "title", label: "A–Z" },
  { id: "artist", label: "Artist" },
  { id: "key", label: "Key" },
  { id: "bpm", label: "BPM" },
  { id: "verified", label: "Verified" },
  { id: "newest", label: "Newest" },
];

const LANG_FILTER_OPTIONS = [
  { id: "All", label: "All" },
  { id: "English", label: "EN" },
  { id: "Malayalam", label: "ML" },
];

function Artwork({ song, size = "md" }) {
  const [err, setErr] = useState(false);
  const s = size === "lg" ? "w-16 h-16" : "w-12 h-12";
  const color = ARTIST_COLORS[song.artist] || "bg-primary/10 border-primary/20";
  const url = song.artwork_url;

  if (url && !err) {
    return (
      <img src={url} alt={song.title} loading="lazy"
        onError={() => setErr(true)}
        className={`${s} rounded-xl object-cover shrink-0 shadow-md`} />
    );
  }
  return (
    <div className={`${s} rounded-xl flex items-center justify-center shrink-0 border ${color}`}>
      <Music className="w-4 h-4 opacity-60" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border/40 rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-white/8 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/8 rounded-lg w-2/3" />
        <div className="h-3 bg-white/5 rounded-lg w-1/3" />
      </div>
      <div className="w-16 h-8 bg-white/5 rounded-lg" />
    </div>
  );
}

function SpotifyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/25 shrink-0">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.974c3.632-1.102 8.147-.568 11.233 1.328a.78.78 0 01.257 1.074zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.794c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 01-.955 1.613z"/>
      </svg>
      Spotify
    </span>
  );
}

function msToMin(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Native catalog song row ─────────────────────────────────────────────────
function NativeSongRow({ song, isAdded, isCloning, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  const badgeClass = ARTIST_COLORS[song.artist] || "bg-secondary text-muted-foreground border-border/40";
  const keyClass = KEY_COLORS[song.key] || "bg-primary/10 text-primary border-primary/20";

  return (
    <div className={`bg-card border rounded-xl transition-all duration-200 overflow-hidden group cursor-pointer
      ${expanded ? "border-primary/40 shadow-lg shadow-primary/8" : "border-border/40 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5"}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 select-none" onClick={() => setExpanded(e => !e)}>
        <Artwork song={song} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate leading-tight group-hover:text-primary/90 transition-colors">
              {(song.language === "Malayalam" && song.malayalam_title) ? song.malayalam_title : song.title}
            </p>
            {song.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0" title="Verified" />}
            {song.verified_status === "Verified" && !song.is_verified && <span className="text-[9px] font-bold bg-green-500/15 text-green-300 border border-green-500/25 rounded px-1.5 py-0.5">✓</span>}
            {song.language === "Malayalam" && <span className="text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/25 rounded px-1.5 py-0.5">ML</span>}

          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>{song.artist}</span>
            {song.language === "Malayalam" && song.transliteration_title && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[160px] opacity-70 italic">{song.transliteration_title}</span>
            )}
            {!song.transliteration_title && song.album && <span className="text-[10px] text-muted-foreground truncate max-w-[130px] hidden sm:block opacity-70">{song.album}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {song.key && <span className={`text-[11px] font-bold border rounded-lg px-2.5 py-1 ${keyClass}`}>{song.key}</span>}
          {song.bpm && <span className="text-[10px] text-muted-foreground font-semibold hidden sm:flex items-center gap-1"><Clock className="w-3 h-3" />{song.bpm}</span>}
          <Button size="sm" onClick={e => { e.stopPropagation(); onAdd(song); }}
            disabled={isAdded || isCloning}
            className={`h-8 px-3 rounded-lg text-xs font-semibold ml-1 transition-all ${
              isAdded ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/20 cursor-default"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}>
            {isCloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             isAdded  ? <><Check className="w-3.5 h-3.5 mr-1" />Added</> :
                        <><Plus className="w-3.5 h-3.5 mr-1" />Add</>}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 bg-background/30 px-4 pb-4 pt-3 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {song.bpm && <span className="text-muted-foreground"><b className="text-foreground">BPM</b> {song.bpm}</span>}
            {song.time_signature && <span className="text-muted-foreground"><b className="text-foreground">Time</b> {song.time_signature}</span>}
            {song.capo > 0 && <span className="text-muted-foreground"><b className="text-foreground">Capo</b> {song.capo}</span>}
            {song.category && <span className="text-muted-foreground"><b className="text-foreground">Style</b> {song.category}</span>}
          </div>
          {song.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
              {song.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-medium border border-border/30">{tag}</span>
              ))}
            </div>
          )}
          {(song.guitar_patch_notes || song.keys_patch_notes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {song.guitar_patch_notes && (
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/30">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">🎸 Guitar</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{song.guitar_patch_notes.split('\n')[0]}</p>
                </div>
              )}
              {song.keys_patch_notes && (
                <div className="bg-background/50 rounded-lg p-2.5 border border-border/30">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">🎹 Keys</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{song.keys_patch_notes.split('\n')[0]}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 flex-wrap pt-0.5">
            {song.youtube_url && (
              <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
                <Youtube className="w-3.5 h-3.5" /> YouTube
              </a>
            )}
            {song.spotify_url && (
              <a href={song.spotify_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-[#1DB954] hover:text-[#1DB954]/80 font-semibold bg-[#1DB954]/10 border border-[#1DB954]/20 px-3 py-1.5 rounded-lg transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Spotify
              </a>
            )}
            {!isAdded && (
              <Button size="sm" onClick={e => { e.stopPropagation(); onAdd(song); }} disabled={isCloning}
                className="h-8 px-4 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 ml-auto">
                {isCloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />Add to My Library</>}
              </Button>
            )}
            {isAdded && <span className="ml-auto flex items-center gap-1.5 text-xs text-accent font-semibold"><Check className="w-3.5 h-3.5" /> Added to library</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Spotify result row ───────────────────────────────────────────────────────
function SpotifyResultRow({ track, isImported, isImporting, onImport, playingId, onTogglePlay }) {
  const isPlaying = playingId === track.spotify_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden group transition-all duration-200
        ${isImported ? "border-[#1DB954]/25" : "border-border/40 hover:border-primary/35 hover:shadow-md hover:shadow-primary/8 hover:-translate-y-0.5"}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Artwork with play overlay */}
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/8 shrink-0 shadow-md">
          {track.artwork_url ? (
            <img src={track.artwork_url_small || track.artwork_url} alt={track.album} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 border border-primary/20">
              <Music className="w-4 h-4 opacity-60" />
            </div>
          )}
          {track.preview_url && (
            <button
              onClick={() => onTogglePlay(track)}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity no-min-h"
            >
              {isPlaying ? (
                <div className="flex gap-0.5 items-end h-4">
                  {[1,2,3].map(i => (
                    <motion.div key={i} className="w-1 bg-[#1DB954] rounded-full"
                      animate={{ height: ["6px","14px","6px"] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </div>
              ) : (
                <Play className="w-4 h-4 text-white fill-white" />
              )}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{track.title}</p>
            <SpotifyBadge />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
          <p className="text-[10px] text-muted-foreground/60 truncate">
            {track.album}{track.duration_ms ? ` · ${msToMin(track.duration_ms)}` : ""}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {track.spotify_url && (
            <a href={track.spotify_url} target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 flex items-center justify-center transition-colors no-min-h"
              title="Open in Spotify" onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-[#1DB954]" />
            </a>
          )}
          <Button size="sm" onClick={() => onImport(track)} disabled={isImported || isImporting}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              isImported
                ? "bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/25 hover:bg-[#1DB954]/15 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}>
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             isImported  ? <><Check className="w-3.5 h-3.5 mr-1" />Added</> :
                           <><Plus className="w-3.5 h-3.5 mr-1" />Add</>}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Duplicate toast ───────────────────────────────────────────────────────────
function DuplicateToast({ title, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <m.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 bg-[#1e1e30] border border-amber-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-black/60 max-w-xs w-[calc(100vw-2rem)]"
    >
      <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground leading-tight truncate">Already in your library</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">"{title}" has already been added.</p>
      </div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-bold shrink-0 no-min-h no-min-w px-1">✕</button>
    </m.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GlobalSongLibrary({ churchId, churchSongs, onSongCloned }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [keyFilter, setKeyFilter] = useState("All");
  const [artistFilter, setArtistFilter] = useState("All");
  const [sortBy, setSortBy] = useState("title");
  const [showFilters, setShowFilters] = useState(false);
  const [cloning, setCloning] = useState(null);
  const [cloned, setCloned] = useState({});
  const [langFilter, setLangFilter] = useState("All");
  const [duplicateToast, setDuplicateToast] = useState(null); // { title }

  // Spotify
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState("");
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  const loadGlobalSongs = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await GlobalSongEntity.list("-created_date", 1000);
      setSongs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Global catalog failed to load", error);
      setSongs([]);
      setLoadError("Could not load the global catalog. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGlobalSongs();
  }, [loadGlobalSongs]);

  useEffect(() => {
    const map = {};
    (churchSongs || []).forEach(s => { if (s.global_song_id) map[s.global_song_id] = true; });
    setCloned(map);
  }, [churchSongs]);

  // Trigger Spotify search when local results are sparse
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 2) { setSpotifyResults([]); setSpotifyError(""); return; }

    debounceRef.current = setTimeout(async () => {
      setSpotifyLoading(true);
      setSpotifyError("");
      try {
        const res = await base44.functions.invoke("spotifySearch", { query: q });
        const data = res?.data ?? res;
        setSpotifyResults(data?.results || []);
      } catch (error) {
        setSpotifyResults([]);
        const status = error?.response?.status;
        const apiMessage = error?.response?.data?.error || error?.message || "";
        if (status === 429 || apiMessage.toLowerCase().includes("rate limit")) {
          setSpotifyError("Spotify search is cooling down from too many requests. Try again in a few minutes.");
        } else if (apiMessage.toLowerCase().includes("spotify_client")) {
          setSpotifyError("Spotify search needs the Spotify Client ID and Client Secret set in Base44.");
        } else {
          setSpotifyError("Spotify search is temporarily unavailable. Your saved catalog still works.");
        }
      } finally {
        setSpotifyLoading(false);
      }
    }, 500);
  }, [search]);

  const artists = ["All", ...Array.from(new Set(songs.map(s => s.artist).filter(Boolean))).sort()];

  // Check if a song title+artist already exists in the church library
  const isDuplicate = useCallback((title, artist) => {
    const t = title?.toLowerCase().trim();
    const a = artist?.toLowerCase().trim();
    return (churchSongs || []).some(s =>
      s.title?.toLowerCase().trim() === t && (!a || !s.artist || s.artist?.toLowerCase().trim() === a)
    );
  }, [churchSongs]);

  const handleAdd = useCallback(async (song) => {
    if (cloning || cloned[song.id]) return;
    if (isDuplicate(song.title, song.artist)) {
      setDuplicateToast({ title: song.title });
      return;
    }
    setCloning(song.id);
    try {
      await base44.entities.Song.create({
        title: song.title, artist: song.artist, album: song.album,
        artwork_url: song.artwork_url, key: song.key, bpm: song.bpm,
        time_signature: song.time_signature, capo: song.capo,
        youtube_url: song.youtube_url, spotify_url: song.spotify_url,
        apple_music_url: song.apple_music_url, chart_content: song.chart_content,
        guitar_patch_notes: song.guitar_patch_notes, keys_patch_notes: song.keys_patch_notes,
        production_notes: song.production_notes, tags: song.tags,
        category: song.category, church_id: churchId, global_song_id: song.id,
      });
      setCloned(prev => ({ ...prev, [song.id]: true }));
      onSongCloned?.();
    } finally { setCloning(null); }
  }, [cloning, cloned, churchId, onSongCloned]);

  const handleSpotifyImport = useCallback(async (track) => {
    if (importingId || importedIds.has(track.spotify_id)) return;
    if (isDuplicate(track.title, track.artist)) {
      setDuplicateToast({ title: track.title });
      return;
    }
    setImportingId(track.spotify_id);
    try {
      await base44.entities.Song.create({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork_url: track.artwork_url,
        spotify_url: track.spotify_url,
        tags: ["spotify-import"],
        church_id: churchId,
      });
      setImportedIds(prev => new Set([...prev, track.spotify_id]));
      onSongCloned?.();
    } catch (e) {
      console.error("Spotify import failed", e);
    } finally {
      setImportingId(null);
    }
  }, [importingId, importedIds, churchId, onSongCloned]);

  const handleTogglePlay = useCallback((track) => {
    if (!track.preview_url) return;
    if (playingId === track.spotify_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(track.preview_url);
    audioRef.current.volume = 0.6;
    audioRef.current.play();
    audioRef.current.onended = () => setPlayingId(null);
    setPlayingId(track.spotify_id);
  }, [playingId]);

  const filtered = songs.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(q) ||
      s.malayalam_title?.toLowerCase().includes(q) ||
      s.transliteration_title?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q) ||
      (Array.isArray(s.tags) ? s.tags : []).some(t => String(t).toLowerCase().includes(q));
    const matchKey = keyFilter === "All" || s.key === keyFilter;
    const matchArtist = artistFilter === "All" || s.artist === artistFilter;
    const matchVerified = sortBy !== "verified" || s.is_verified;
    const matchLang = langFilter === "All" || s.language === langFilter || (!s.language && langFilter === "English");

    return matchSearch && matchKey && matchArtist && matchVerified && matchLang;
  }).sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "artist") return (a.artist || "").localeCompare(b.artist || "");
    if (sortBy === "key") return (a.key || "").localeCompare(b.key || "");
    if (sortBy === "bpm_asc") return (a.bpm || 0) - (b.bpm || 0);
    if (sortBy === "bpm_desc") return (b.bpm || 0) - (a.bpm || 0);
    if (sortBy === "verified") return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0);
    if (sortBy === "newest") return (b.created_date || "").localeCompare(a.created_date || "");
    return 0;
  });

  // Dedupe Spotify results: hide if already in native catalog (by title+artist)
  const nativeTitles = new Set(filtered.map(s => `${s.title?.toLowerCase()}|${s.artist?.toLowerCase()}`));
  const dedupedSpotify = search.trim().length >= 2
    ? spotifyResults.filter(t => !nativeTitles.has(`${t.title?.toLowerCase()}|${t.artist?.toLowerCase()}`))
    : [];

  const showSpotifySection = search.trim().length >= 2 && (spotifyLoading || dedupedSpotify.length > 0 || !!spotifyError);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
      <p className="text-xs text-muted-foreground font-medium">Loading worship catalog...</p>
    </div>
  );

  if (loadError) return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-center space-y-3">
      <AlertCircle className="w-8 h-8 text-red-300 mx-auto" />
      <div>
        <p className="text-sm font-bold text-foreground">Global Catalog did not load</p>
        <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
      </div>
      <Button type="button" onClick={loadGlobalSongs} className="bg-primary text-primary-foreground">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3.5 py-2.5 focus-within:border-primary/50 transition-all">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search songs, artists, albums..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 font-medium" />
          {(spotifyLoading) && <Loader2 className="w-3.5 h-3.5 text-[#1DB954] animate-spin shrink-0" />}
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:text-foreground"}`}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </button>
      </div>

      {/* Language filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-4 scrollbar-hide" style={SCROLL_FADE_STYLE}>
        {LANG_FILTER_OPTIONS.map(l => (
          <button key={l.id} onClick={() => setLangFilter(l.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
              langFilter === l.id
                ? l.id === "Malayalam" ? "bg-orange-500/30 text-orange-200 border-orange-500/40"
                  : l.id === "Mixed" ? "bg-violet-500/30 text-violet-200 border-violet-500/40"
                  : "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card border-border/40 text-muted-foreground hover:text-foreground"
            }`}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Sort pills */}
      <div className="flex gap-1">
        {SORT_OPTIONS.map(s => {
          const isBpm = s.id === "bpm";
          const active = isBpm ? sortBy.startsWith("bpm") : sortBy === s.id;
          const label = isBpm ? (sortBy === "bpm_desc" ? "BPM↓" : "BPM↑") : s.label;
          return (
            <button key={s.id} onClick={() => setSortBy(isBpm ? (sortBy === "bpm_asc" ? "bpm_desc" : "bpm_asc") : s.id)}
              className={`flex-1 min-w-0 px-1 py-1.5 rounded-lg text-[9px] font-bold whitespace-nowrap overflow-hidden text-ellipsis transition-all border ${active ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border/40 text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-border/40 rounded-xl p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Key</p>
            <div className="flex flex-wrap gap-1.5">
              {KEYS.map(k => (
                <button key={k} onClick={() => setKeyFilter(k)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${keyFilter === k ? "bg-primary text-primary-foreground border-primary" : `${KEY_COLORS[k] || "bg-secondary text-muted-foreground border-border/40"} hover:opacity-80`}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Artist</p>
            <div className="flex flex-wrap gap-1.5">
              {artists.map(a => {
                const bc = ARTIST_COLORS[a];
                return (
                  <button key={a} onClick={() => setArtistFilter(a)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${artistFilter === a ? "bg-primary text-primary-foreground border-primary" : `${bc || "bg-secondary text-muted-foreground border-border/40"} hover:opacity-80`}`}>
                    {a === "All" ? "All Artists" : a.split(" ").slice(0, 2).join(" ")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground font-medium">
        {filtered.length} of {songs.length} songs
        {keyFilter !== "All" && <span className="ml-1 text-primary font-bold">· Key of {keyFilter}</span>}
        {showSpotifySection && !spotifyLoading && (
          <span className="ml-2 text-[#1DB954] font-bold">+ {dedupedSpotify.length} from Spotify</span>
        )}
      </p>

      {/* Native results */}
      <div className="grid gap-2">
        {filtered.map(song => (
          <NativeSongRow
            key={song.id}
            song={song}
            isAdded={!!cloned[song.id]}
            isCloning={cloning === song.id}
            onAdd={handleAdd}
          />
        ))}

        {filtered.length === 0 && !showSpotifySection && (
          <div className="text-center py-14 text-muted-foreground">
            <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No songs match your search.</p>
            <p className="text-xs mt-1 opacity-60">Searching Spotify below...</p>
          </div>
        )}
      </div>

      {/* Duplicate toast */}
      <AP>
        {duplicateToast && (
          <DuplicateToast key="dup" title={duplicateToast.title} onClose={() => setDuplicateToast(null)} />
        )}
      </AP>

      {/* Spotify section */}
      <AnimatePresence>
        {showSpotifySection && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1DB954] px-2">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.974c3.632-1.102 8.147-.568 11.233 1.328a.78.78 0 01.257 1.074zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.794c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 01-.955 1.613z"/>
                </svg>
                More from Spotify
              </div>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="grid gap-2">
              {spotifyLoading
                ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
                : spotifyError ? (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-100">Spotify search paused</p>
                        <p className="text-xs text-amber-100/75 mt-0.5">{spotifyError}</p>
                      </div>
                    </div>
                  )
                : dedupedSpotify.map(track => (
                    <SpotifyResultRow
                      key={track.spotify_id}
                      track={track}
                      isImported={importedIds.has(track.spotify_id)}
                      isImporting={importingId === track.spotify_id}
                      onImport={handleSpotifyImport}
                      playingId={playingId}
                      onTogglePlay={handleTogglePlay}
                    />
                  ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
