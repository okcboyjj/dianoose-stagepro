import { useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, X, Loader2, Music, Search, Plus, Trash2, Save } from "lucide-react";
import { SCROLL_FADE_STYLE } from "@/lib/utils";

const MyLibrarySongEntity = base44.entities.MyLibrarySong;

const CATEGORIES = ["Worship", "Practice", "Reference", "Favorites"];

function LibrarySongModal({ entry, song, onClose, onSave, onRemove }) {
  const [form, setForm] = useState({
    preferred_key: entry?.preferred_key || song?.key || "",
    personal_notes: entry?.personal_notes || "",
    category: entry?.category || "Worship",
    rating: entry?.rating || 0
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (entry?.id) {
      await MyLibrarySongEntity.update(entry.id, form);
    }
    setSaving(false);
    onSave();
  };

  const handleRemove = async () => {
    if (entry?.id) await MyLibrarySongEntity.delete(entry.id);
    onRemove();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/20">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-base truncate">{song?.title || "Song"}</h3>
            <p className="text-xs text-muted-foreground">{song?.artist}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">My Preferred Key</Label>
            <Input value={form.preferred_key} onChange={e => set("preferred_key", e.target.value)} placeholder={`Original: ${song?.key || "—"}`} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">Personal Notes</Label>
            <Textarea value={form.personal_notes} onChange={e => set("personal_notes", e.target.value)} placeholder="My arrangement notes, cues, personal reminders..." rows={4} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm resize-none" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">Category</Label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className="mt-1.5 w-full bg-background/50 border border-border/50 text-foreground text-sm rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 transition-colors">
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1 block mb-2">Rating</Label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => set("rating", n)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${form.rating >= n ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                  <Star className={`w-4 h-4 ${form.rating >= n ? "fill-primary" : ""}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-secondary/10">
          <button onClick={handleRemove} className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} className="border-border/50 text-foreground hover:bg-background h-10 px-5 rounded-lg">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-semibold px-5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" />Save</>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function AddToLibraryModal({ songs, libraryIds, userId, churchId, onClose, onAdded }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(null);

  const available = songs.filter(s => !libraryIds.includes(s.id) && (!search || s.title?.toLowerCase().includes(search.toLowerCase())));

  const handleAdd = async (song) => {
    setAdding(song.id);
    await MyLibrarySongEntity.create({ song_id: song.id, user_id: userId, church_id: churchId, category: "Worship", rating: 0, preferred_key: song.key || "" });
    setAdding(null);
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/20">
          <h3 className="font-bold text-foreground text-lg">Add to My Library</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 bg-background/50 border border-border/50 rounded-xl px-3 py-2 mb-3 focus-within:border-primary/50 transition-all">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search songs..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1" autoFocus />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {available.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">All songs are in your library!</p>}
            {available.map(song => (
              <button key={song.id} onClick={() => handleAdd(song)} disabled={adding === song.id} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 transition-all text-left group">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Music className="w-4 h-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground">{song.artist}{song.key ? ` · ${song.key}` : ""}</p>
                </div>
                {adding === song.id ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100" />}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function MyLibrarySection({ songs, myLibrary, user, church, onRefresh, onPreviewSong }) {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const libraryIds = myLibrary.map(e => e.song_id);

  const enriched = myLibrary.map(entry => ({
    ...entry,
    song: songs.find(s => s.id === entry.song_id)
  })).filter(e => e.song);

  const filtered = enriched.filter(e => {
    const matchCat = categoryFilter === "All" || e.category === categoryFilter;
    const matchSearch = !search || e.song?.title?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortBy === "alpha") return (a.song?.title || "").localeCompare(b.song?.title || "");
    if (sortBy === "artist") return (a.song?.artist || "").localeCompare(b.song?.artist || "");
    if (sortBy === "key") return (a.preferred_key || a.song?.key || "").localeCompare(b.preferred_key || b.song?.key || "");
    if (sortBy === "bpm") return (b.song?.bpm || 0) - (a.song?.bpm || 0);
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "favorites") return (b.song?.is_favorite ? 1 : 0) - (a.song?.is_favorite ? 1 : 0);
    // newest = default (created_date desc)
    return (b.created_date || "").localeCompare(a.created_date || "");
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">⭐ My Library</h1>
          <p className="text-sm text-muted-foreground font-medium">Your personal collection — private notes, preferred keys, ratings.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
          <Plus className="w-4 h-4 mr-2" /> Add Song
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["All", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === c ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"}`}>
            {c === "Worship" ? "🙏 Worship" : c === "Practice" ? "🎸 Practice" : c === "Reference" ? "📚 Reference" : c === "Favorites" ? "❤ Favorites" : c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-primary/50 transition-all">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search my library..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 font-medium" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-4 scrollbar-hide" style={SCROLL_FADE_STYLE}>
        {[{ id: "newest", label: "Newest" }, { id: "alpha", label: "A–Z" }, { id: "artist", label: "Artist" }, { id: "key", label: "Key" }, { id: "bpm", label: "BPM" }, { id: "rating", label: "Rating" }, { id: "favorites", label: "⭐ Fav" }].map(s => (
          <button key={s.id} onClick={() => setSortBy(s.id)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${sortBy === s.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border/40 text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-4"><Star className="w-7 h-7 text-muted-foreground" /></div>
          <p className="text-foreground font-semibold mb-1">Your library is empty</p>
          <p className="text-sm text-muted-foreground">Add songs from the Song Library to build your personal collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(entry => {
            const song = entry.song;
            const sections = song?.arrangement_sections || [];
            const displayKey = entry.preferred_key || song?.key;
            const extraSections = sections.length > 3 ? sections.length - 3 : 0;
            return (
              <div key={entry.id} onClick={() => onPreviewSong?.(song, 'chart')} className="bg-[#1a1a2c] border border-white/10 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/40 transition-all" style={{ transition: 'border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)'; e.currentTarget.style.boxShadow = '0 0 20px hsl(var(--primary) / 0.10), 0 6px 20px rgba(0,0,0,0.3)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate leading-tight" style={song?.language === 'Malayalam' ? { fontFamily: 'system-ui, sans-serif' } : {}}>
                        {(song?.language === 'Malayalam' && song?.malayalam_title) ? song.malayalam_title : song?.title}
                      </p>
                      {song?.language === 'Malayalam' && <span className="text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/25 rounded px-1.5 py-0.5 shrink-0">ML</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {song?.language === 'Malayalam' && song?.transliteration_title
                        ? song.transliteration_title
                        : song?.artist}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {displayKey && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{displayKey}</span>
                      </div>
                    )}
                    <button className="text-muted-foreground hover:text-yellow-400 transition-colors">
                      <Star className={`w-4 h-4 ${entry.rating > 0 ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Meta pills */}
                <div className="flex flex-wrap gap-1.5">
                  {song?.bpm && <span className="text-[10px] font-semibold bg-secondary/60 text-muted-foreground border border-white/10 rounded-full px-2.5 py-0.5">{song.bpm} BPM</span>}
                  {song?.time_signature && <span className="text-[10px] font-semibold bg-secondary/60 text-muted-foreground border border-white/10 rounded-full px-2.5 py-0.5">{song.time_signature}</span>}
                  {Number(song?.capo) > 0 && <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 rounded-full px-2.5 py-0.5">Capo {song.capo}</span>}
                  {song?.chart_content && <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 rounded-full px-2.5 py-0.5">Chart</span>}
                </div>

                {/* Arrangement sections */}
                {sections.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sections.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] font-semibold bg-secondary/40 text-muted-foreground border border-white/10 rounded-md px-2 py-0.5">{s}</span>
                    ))}
                    {extraSections > 0 && (
                      <span className="text-[10px] font-semibold bg-secondary/40 text-muted-foreground border border-white/10 rounded-md px-2 py-0.5">+{extraSections}</span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1 border-t border-white/10">
                  <button onClick={() => setSelectedEntry(entry)} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-white/4 hover:bg-white/10 rounded-lg py-1.5 transition-all">
                    ⌘ Edit
                  </button>
                  <button onClick={() => onPreviewSong?.(song, 'chart')} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary bg-white/4 hover:bg-primary/10 rounded-lg py-1.5 transition-all">
                    📄 Chart
                  </button>
                  <button onClick={() => onPreviewSong?.(song, 'patches')} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-white/4 hover:bg-white/10 rounded-lg py-1.5 transition-all">
                    🎛 Patch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedEntry && (
        <LibrarySongModal
          entry={selectedEntry}
          song={selectedEntry.song}
          onClose={() => setSelectedEntry(null)}
          onSave={() => { setSelectedEntry(null); onRefresh(); }}
          onRemove={() => { setSelectedEntry(null); onRefresh(); }}
        />
      )}
      {showAdd && (
        <AddToLibraryModal
          songs={songs}
          libraryIds={libraryIds}
          userId={user?.user_id || user?.id}
          churchId={church?.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
    </div>
  );
}