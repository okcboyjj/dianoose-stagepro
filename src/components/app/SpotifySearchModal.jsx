import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Music, ExternalLink, Play, Plus, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

function msToMin(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SpotifySearchModal({ church, onClose, onImported }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());
  const [playingId, setPlayingId] = useState(null);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  const handleSearch = useCallback((val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await base44.functions.invoke("spotifySearch", { query: val });
        // invoke may return data directly or nested under .data
        const data = res?.data ?? res;
        setResults(data?.results || []);
      } catch (e) {
        setError("Search failed. Check your Spotify credentials.");
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handlePreview = (track) => {
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
  };

  const handleImportFull = async (track) => {
    if (importingId || importedIds.has(track.spotify_id)) return;
    setImportingId(track.spotify_id);
    try {
      await base44.entities.Song.create({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork_url: track.artwork_url,
        spotify_url: track.spotify_url,
        church_id: church?.id,
        tags: ["spotify-import"],
      });
      setImportedIds(prev => new Set([...prev, track.spotify_id]));
      onImported?.();
    } catch (e) {
      console.error("Import failed", e);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-full sm:max-w-2xl bg-[#0d0d1a] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "92vh" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10">
            <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1DB954]">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.974c3.632-1.102 8.147-.568 11.233 1.328a.78.78 0 01.257 1.074zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.794c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 01-.955 1.613z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-foreground leading-tight">Spotify Song Search</h2>
              <p className="text-xs text-muted-foreground">Search & import real song metadata</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors no-min-h">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Search input */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#1DB954]/50 transition-all">
              {loading ? <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin shrink-0" /> : <Search className="w-4 h-4 text-muted-foreground shrink-0" />}
              <input
                autoFocus
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search worship songs, hymns, artists..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); }} className="no-min-h">
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
            {error && (
              <div className="text-center py-8 text-sm text-destructive">{error}</div>
            )}

            {!loading && results.length === 0 && query.length >= 2 && !error && (
              <div className="text-center py-12">
                <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No results for "{query}"</p>
              </div>
            )}

            {!query && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-[#1DB954]/60" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Search for a worship song</p>
                <p className="text-xs text-muted-foreground mt-1 opacity-60">Artwork, album, artist & preview links from Spotify</p>
              </div>
            )}

            {results.map((track) => {
              const isImported = importedIds.has(track.spotify_id);
              const isImporting = importingId === track.spotify_id;
              const isPlaying = playingId === track.spotify_id;

              return (
                <motion.div
                  key={track.spotify_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-white/4 hover:bg-white/7 border border-white/8 hover:border-white/15 rounded-xl p-3 transition-all group"
                >
                  {/* Artwork */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/10 shrink-0">
                    {track.artwork_url_small || track.artwork_url ? (
                      <img
                        src={track.artwork_url_small || track.artwork_url}
                        alt={track.album}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-5 h-5 text-muted-foreground opacity-40" />
                      </div>
                    )}
                    {track.preview_url && (
                      <button
                        onClick={() => handlePreview(track)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity no-min-h"
                      >
                        {isPlaying ? (
                          <div className="flex gap-0.5 items-end h-4">
                            {[1,2,3].map(i => (
                              <motion.div key={i} className="w-1 bg-[#1DB954] rounded-full"
                                animate={{ height: ["6px","14px","6px"] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                              />
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
                    <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{track.album}{track.duration_ms ? ` · ${msToMin(track.duration_ms)}` : ""}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {track.spotify_url && (
                      <a href={track.spotify_url} target="_blank" rel="noreferrer"
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 flex items-center justify-center transition-colors no-min-h"
                        title="Open in Spotify"
                      >
                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-[#1DB954]" />
                      </a>
                    )}
                    <button
                      onClick={() => handleImportFull(track)}
                      disabled={isImported || isImporting}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all no-min-h ${
                        isImported
                          ? "bg-green-500/15 text-green-400 border border-green-500/20"
                          : "bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 hover:scale-105"
                      }`}
                    >
                      {isImporting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isImported ? (
                        <><Check className="w-3 h-3" /> Added</>
                      ) : (
                        <><Plus className="w-3 h-3" /> Import</>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}