import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Loader2, Music, List, Save, Trash2, Calendar, Presentation } from "lucide-react";
import MobileSelect from "@/components/ui/MobileSelect";
import ServiceRosterPanel from "./service/ServiceRosterPanel";
import ServiceAssignmentPanel from "./service/ServiceAssignmentPanel";
import SongSuggestionsPanel from "./service/SongSuggestionsPanel";
import StageMode from "./service/StageMode";

const ServiceEntity = base44.entities.Service;

const SERVICE_TYPES = ["Sunday Morning", "Sunday Evening", "Youth Night", "Mid-Week", "Special Event", "Holiday Service"];

function NewServiceModal({ churchId, onClose, onSave }) {
  const [form, setForm] = useState({ name: "", date: "", time: "", type: "Sunday Morning", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await ServiceEntity.create({
      ...form, church_id: churchId, status: "upcoming",
      songs: [], musicians: [], role_assignments: [], song_suggestions: []
    });
    track("service_created");
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/20">
          <h3 className="font-bold text-foreground text-lg">+ New Service</h3>
          <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">Service Name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sunday Morning Worship" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground ml-1">Date</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground ml-1">Time</Label>
              <Input type="time" value={form.time} onChange={e => set("time", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">Type</Label>
            <div className="mt-1.5">
              <MobileSelect value={form.type} onChange={v => set("type", v)} options={SERVICE_TYPES} />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground ml-1">Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Theme, series, special instructions..." rows={3} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-secondary/10">
          <Button variant="outline" onClick={onClose} className="border-border/50 text-foreground hover:bg-background h-10 px-5 rounded-lg">Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim()} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Service"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ServiceDetailModal({ service, songs, allMembers, currentUser, isAdmin, onClose, onSave }) {
  const [tab, setTab] = useState("setlist");
  const [form, setForm] = useState({ ...service });
  const [saving, setSaving] = useState(false);
  const [songSearch, setSongSearch] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const serviceSongs = (form.songs || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
  const availableSongs = songs.filter(s => {
    if ((form.songs || []).includes(s.id)) return false;
    if (!songSearch) return true;
    const q = songSearch.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.malayalam_title?.toLowerCase().includes(q) ||
      s.transliteration_title?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q)
    );
  });

  const addSong = (songId) => set("songs", [...(form.songs || []), songId]);
  const removeSong = (songId) => set("songs", (form.songs || []).filter(id => id !== songId));

  const handleSave = async () => {
    setSaving(true);
    await ServiceEntity.update(service.id, form);
    setSaving(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this service?")) return;
    await ServiceEntity.delete(service.id);
    onSave();
  };

  const TABS = [
    { id: "setlist", label: "🎵 Setlist" },
    { id: "roster", label: "🎭 Roster" },
    { id: "assignments", label: "👥 Team" },
    { id: "suggestions", label: "💡 Suggest" },
    { id: "info", label: "ℹ️ Info" },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-50" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/20">
          <div>
            <h3 className="font-bold text-foreground text-lg truncate">{form.name || "Service"}</h3>
            {form.date && <p className="text-xs text-muted-foreground">{new Date(form.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-semibold h-8 px-4">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1.5" />Save</>}
            </Button>
            <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-2 bg-secondary/10 border-b border-border/50 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              {tab === "setlist" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Current Setlist ({serviceSongs.length})</p>
                    {serviceSongs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6 bg-secondary/20 rounded-xl border border-border/30">No songs added yet.</p>}
                    <div className="space-y-2">
                      {serviceSongs.map((song, i) => (
                        <div key={song.id} className="flex items-center gap-3 bg-secondary/30 rounded-xl px-4 py-3 group">
                          <span className="text-xs text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate" style={song.language === 'Malayalam' ? { fontFamily: 'system-ui, sans-serif' } : {}}>
                              {(song.language === 'Malayalam' && song.malayalam_title) ? song.malayalam_title : song.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {song.language === 'Malayalam' && song.transliteration_title
                                ? song.transliteration_title
                                : song.artist}
                              {song.key ? ` · Key of ${song.key}` : ""}
                            </p>
                          </div>
                          {isAdmin && <button onClick={() => removeSong(song.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Add Songs</p>
                      <div className="flex items-center gap-2 bg-background/50 border border-border/50 rounded-xl px-3 py-2 mb-3 focus-within:border-primary/50 transition-all">
                        <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Search song library..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1" />
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {availableSongs.slice(0, 20).map(song => (
                          <button key={song.id} onClick={() => addSong(song.id)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-background/30 hover:bg-primary/10 hover:border-primary/30 border border-transparent transition-all text-left group">
                            <Music className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="text-sm text-foreground flex-1 truncate" style={song.language === 'Malayalam' ? { fontFamily: 'system-ui, sans-serif' } : {}}>
                              {(song.language === 'Malayalam' && song.malayalam_title) ? song.malayalam_title : song.title}
                            </span>
                            {song.key && <span className="text-xs text-primary/70 font-medium">{song.key}</span>}
                            <Plus className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 shrink-0" />
                          </button>
                        ))}
                        {availableSongs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No songs found</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "roster" && (
                <ServiceRosterPanel
                  service={form}
                  allMembers={allMembers}
                  isAdmin={isAdmin}
                  onChange={(role_assignments) => set("role_assignments", role_assignments)}
                />
              )}

              {tab === "assignments" && (
                <ServiceAssignmentPanel
                  service={service}
                  allMembers={allMembers}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  onRefresh={onSave}
                />
              )}

              {tab === "suggestions" && (
                <SongSuggestionsPanel
                  service={form}
                  songs={songs}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
                />
              )}

              {tab === "info" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Service Name</Label>
                    <Input value={form.name || ""} onChange={e => set("name", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Date</Label>
                      <Input type="date" value={form.date || ""} onChange={e => set("date", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Time</Label>
                      <Input type="time" value={form.time || ""} onChange={e => set("time", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Type</Label>
                    <div className="mt-1.5">
                      <MobileSelect value={form.type || "Sunday Morning"} onChange={v => set("type", v)} options={SERVICE_TYPES} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Status</Label>
                    <div className="mt-1.5">
                      <MobileSelect value={form.status || "upcoming"} onChange={v => set("status", v)} options={["upcoming", "past"]} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Notes</Label>
                    <Textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={4} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-secondary/10">
          {isAdmin && <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium transition-all"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} className="border-border/50 text-foreground hover:bg-background h-10 px-5 rounded-lg">Close</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-semibold px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ServicesSection({ church, songs, services, members, currentUser, isAdmin, onRefresh }) {
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [stageService, setStageService] = useState(null);

  // Persist a per-song arrangement decision (key/tempo/notes) onto the service, so what's
  // set at rehearsal is what Stage Mode loads on Sunday. Optimistic local update + write.
  const saveArrangement = (songId, patch) => {
    setStageService(prev => {
      if (!prev) return prev;
      const arrangements = {
        ...(prev.arrangements || {}),
        [songId]: { ...(prev.arrangements?.[songId] || {}), ...patch },
      };
      base44.entities.Service.update(prev.id, { arrangements }).catch(() => {});
      return { ...prev, arrangements };
    });
  };

  const filtered = services.filter(s => {
    if (filter === "Upcoming") return s.status !== "past";
    if (filter === "Past") return s.status === "past";
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground font-medium">Plan and manage every worship service.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowNew(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            <Plus className="w-4 h-4 mr-2" /> New Service
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {["All", "Upcoming", "Past"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === f ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"}`}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-4"><List className="w-7 h-7 text-muted-foreground" /></div>
          <p className="text-foreground font-semibold mb-1">No services yet</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Click "+ New Service" to plan your first service.' : "No services have been scheduled yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(service => {
            const songCount = (service.songs || []).length;
            const memberCount = (service.musicians || []).length;
            const isUpcoming = service.status !== "past";
            const pendingSuggestions = (service.song_suggestions || []).filter(s => s.status === "pending").length;
            return (
              <div key={service.id} onClick={() => setSelectedService(service)} className="glass-panel rounded-xl px-5 py-4 hover:border-primary/50 transition-all duration-300 cursor-pointer group flex items-center gap-5 hover:shadow-lg hover:-translate-y-0.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isUpcoming ? "bg-primary/10 group-hover:bg-primary/20" : "bg-secondary/50"}`}>
                  <Calendar className={`w-5 h-5 ${isUpcoming ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">{service.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {service.date && <span className="text-xs text-muted-foreground font-medium">{new Date(service.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>}
                    {service.time && <span className="text-xs text-muted-foreground">{service.time}</span>}
                    {service.type && <span className="text-xs text-muted-foreground">{service.type}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {songCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); track("stage_mode_opened", { songs: songCount }); setStageService(service); }}
                      title="Open Stage Mode (hands-free charts)"
                      className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/30 text-primary rounded-lg px-2.5 py-1 font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Presentation className="w-3.5 h-3.5" /> Stage
                    </button>
                  )}
                  <span className="text-xs bg-secondary border border-border/50 text-muted-foreground rounded-lg px-2.5 py-1 font-medium">{songCount} song{songCount !== 1 ? "s" : ""}</span>
                  {pendingSuggestions > 0 && (
                    <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg px-2.5 py-1 font-medium">{pendingSuggestions} suggestion{pendingSuggestions !== 1 ? "s" : ""}</span>
                  )}
                  <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 uppercase tracking-wider ${isUpcoming ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground border border-border/30"}`}>{isUpcoming ? "Upcoming" : "Past"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewServiceModal churchId={church.id} onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); onRefresh(); }} />}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          songs={songs}
          allMembers={members || []}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={() => setSelectedService(null)}
          onSave={() => { setSelectedService(null); onRefresh(); }}
        />
      )}
      {stageService && (
        <StageMode
          service={stageService}
          songs={songs}
          currentUser={currentUser}
          onClose={() => setStageService(null)}
          onSaveArrangement={saveArrangement}
        />
      )}
    </div>
  );
}