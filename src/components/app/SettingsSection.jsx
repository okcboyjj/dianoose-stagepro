import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { applyChurchTheme } from "@/lib/applyTheme.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Check, Trash2, AlertTriangle, Upload, Palette, Image, Music, AlertCircle, Church, Calendar, User } from "lucide-react";
import MobileSelect from "@/components/ui/MobileSelect";

const ChurchEntity = base44.entities.Church;
const ChurchMemberEntity = base44.entities.ChurchMember;

const AVATAR_COLORS = ["#6C63FF", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#8B5CF6", "#14B8A6"];

const PRESET_THEMES = [
  { id: "default",  label: "Indigo Night",  primary: "#7C6FFF", glow: "#6C63FF" },
  { id: "emerald",  label: "Emerald",        primary: "#10B981", glow: "#059669" },
  { id: "rose",     label: "Rose",           primary: "#F43F5E", glow: "#E11D48" },
  { id: "amber",    label: "Amber",          primary: "#F59E0B", glow: "#D97706" },
  { id: "sky",      label: "Sky Blue",       primary: "#0EA5E9", glow: "#0284C7" },
  { id: "violet",   label: "Violet",         primary: "#8B5CF6", glow: "#7C3AED" },
];

function SaveBar({ saving, saved }) {
  if (saving) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</div>;
  if (saved) return <div className="flex items-center gap-2 text-xs text-accent"><Check className="w-3.5 h-3.5" /> Saved!</div>;
  return null;
}

export default function SettingsSection({ church, user, onChurchUpdate, onUserUpdate }) {
  const [tab, setTab] = useState("church");

  // Church info
  const [churchForm, setChurchForm] = useState({ name: church?.name || "", city: church?.city || "", state: church?.state || "", website: church?.website || "", denomination: church?.denomination || "" });
  const [churchSaving, setChurchSaving] = useState(false);
  const [churchSaved, setChurchSaved] = useState(false);

  // Schedule
  const [schedForm, setSchedForm] = useState({ service_day: church?.service_day || "Sunday", service_time: church?.service_time || "10:00", service_name: church?.service_name || "Morning Worship", timezone: church?.timezone || "Eastern (ET)" });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);

  // Theme / branding
  const [themeForm, setThemeForm] = useState({ accent_color: church?.accent_color || "#6C63FF", glow_color: church?.glow_color || "#6C63FF", logo_url: church?.logo_url || "" });
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoRef = useRef(null);

  // Profile
  const [profileForm, setProfileForm] = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", instrument: user?.instrument || "", avatar_color: user?.avatar_color || AVATAR_COLORS[0] });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const setC = (k, v) => setChurchForm(f => ({ ...f, [k]: v }));
  const setSc = (k, v) => setSchedForm(f => ({ ...f, [k]: v }));
  const setP = (k, v) => setProfileForm(f => ({ ...f, [k]: v }));
  const setT = (k, v) => {
    setThemeForm(f => {
      const next = { ...f, [k]: v };
      // Live-preview: apply to CSS vars immediately as the picker changes
      applyChurchTheme({ accent_color: next.accent_color, glow_color: next.glow_color });
      return next;
    });
  };

  const saveChurch = async () => {
    setChurchSaving(true);
    await ChurchEntity.update(church.id, churchForm);
    setChurchSaving(false); setChurchSaved(true);
    onChurchUpdate({ ...church, ...churchForm });
    setTimeout(() => setChurchSaved(false), 2500);
  };

  const saveSched = async () => {
    setSchedSaving(true);
    await ChurchEntity.update(church.id, schedForm);
    setSchedSaving(false); setSchedSaved(true);
    onChurchUpdate({ ...church, ...schedForm });
    setTimeout(() => setSchedSaved(false), 2500);
  };

  const saveTheme = async () => {
    setThemeSaving(true);
    await ChurchEntity.update(church.id, themeForm);
    setThemeSaving(false); setThemeSaved(true);
    const updated = { ...church, ...themeForm };
    applyChurchTheme(updated);
    onChurchUpdate(updated);
    setTimeout(() => setThemeSaved(false), 2500);
  };

  const applyPreset = (preset) => {
    setThemeForm(f => ({ ...f, accent_color: preset.primary, glow_color: preset.glow }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    setLogoUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setThemeForm(f => ({ ...f, logo_url: file_url }));
      // Immediately propagate so sidebar/header update without saving
      onChurchUpdate({ ...church, ...themeForm, logo_url: file_url });
    } catch {
      setLogoError("Upload failed. Please try again or check your connection.");
    } finally {
      setLogoUploading(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  const handleLogoRemove = () => {
    setThemeForm(f => ({ ...f, logo_url: "" }));
    onChurchUpdate({ ...church, ...themeForm, logo_url: "" });
    setLogoError("");
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    await ChurchMemberEntity.update(user.id, profileForm);
    await base44.auth.updateMe({ full_name: `${profileForm.first_name} ${profileForm.last_name}` });
    setProfileSaving(false); setProfileSaved(true);
    onUserUpdate({ ...user, ...profileForm });
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      if (user?.id) await ChurchMemberEntity.delete(user.id);
      await base44.auth.logout("/");
    } catch (e) {
      setDeleting(false);
    }
  };

  const savePassword = async () => {
    setPwError("");
    if (!pwForm.newPw || pwForm.newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("Passwords don't match."); return; }
    setPwSaving(true);
    try {
      await base44.auth.changePassword(pwForm.current, pwForm.newPw);
      setPwSaved(true); setPwForm({ current: "", newPw: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 2500);
    } catch (e) {
      setPwError(e.message || "Failed to change password.");
    } finally { setPwSaving(false); }
  };

  const tabs = [
    { id: "church", label: "Church", icon: Church },
    { id: "schedule", label: "Schedule", icon: Calendar },
    { id: "branding", label: "Branding", icon: Palette },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground font-medium">Customize your church workspace and personal preferences.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "church" && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2"><Church className="w-4 h-4" /> Church Info</h2>
              <SaveBar saving={churchSaving} saved={churchSaved} />
            </div>
            <div className="space-y-4">
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Church Name</Label><Input value={churchForm.name} onChange={e => setC("name", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">City</Label><Input value={churchForm.city} onChange={e => setC("city", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">State</Label><Input value={churchForm.state} onChange={e => setC("state", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              </div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Website</Label><Input value={churchForm.website} onChange={e => setC("website", e.target.value)} placeholder="https://yourchurch.com" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Denomination</Label><Input value={churchForm.denomination} onChange={e => setC("denomination", e.target.value)} placeholder="e.g. Non-denominational, Baptist..." className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
            </div>
            <Button onClick={saveChurch} disabled={churchSaving} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold px-6">
              {churchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Church Info</>}
            </Button>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> Service Schedule</h2>
            <SaveBar saving={schedSaving} saved={schedSaved} />
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground ml-1">Service Day</Label>
              <div className="mt-1.5">
                <MobileSelect value={schedForm.service_day} onChange={v => setSc("service_day", v)} options={["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Time</Label><Input type="time" value={schedForm.service_time} onChange={e => setSc("service_time", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Service Name</Label><Input value={schedForm.service_name} onChange={e => setSc("service_name", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground ml-1">Timezone</Label>
              <div className="mt-1.5">
                <MobileSelect value={schedForm.timezone} onChange={v => setSc("timezone", v)} options={["Eastern (ET)","Central (CT)","Mountain (MT)","Pacific (PT)","UTC"]} />
              </div>
            </div>
          </div>
          <Button onClick={saveSched} disabled={schedSaving} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold px-6">
            {schedSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Schedule</>}
          </Button>
        </div>
      )}

      {tab === "branding" && (
        <div className="space-y-6">
          {/* Logo Upload */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Church Logo</h2>
              </div>
              <SaveBar saving={themeSaving} saved={themeSaved} />
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* Upload controls */}
              <div className="flex-1 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">Upload a PNG with a transparent background for best results. Your logo appears in the sidebar, mobile header, and login screen.</p>
                <div className="flex gap-2 flex-wrap">
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button onClick={() => logoRef.current?.click()} disabled={logoUploading} variant="outline" className="border-border/50 text-foreground h-9 px-4 rounded-lg text-xs font-semibold">
                    {logoUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Uploading...</> : <><Upload className="w-3.5 h-3.5 mr-2" />Upload Logo</>}
                  </Button>
                  {themeForm.logo_url && (
                    <Button onClick={handleLogoRemove} variant="outline" className="border-destructive/30 text-destructive h-9 px-3 rounded-lg text-xs font-semibold">Remove</Button>
                  )}
                </div>
                {logoError && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{logoError}</p>
                  </div>
                )}
              </div>

              {/* Sidebar preview */}
              <div className="shrink-0">
                <p className="text-xs text-muted-foreground font-medium mb-2">Sidebar preview</p>
                <div className="bg-card border border-border/40 rounded-xl p-3 flex items-center gap-3 w-56">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: themeForm.accent_color + "33" }}>
                    {themeForm.logo_url ? (
                      <img src={themeForm.logo_url} alt="logo preview" className="w-full h-full object-cover scale-[1.35]" />
                    ) : (
                      <Music className="w-4 h-4" style={{ color: themeForm.accent_color }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">Dianoose Stage</p>
                    <p className="text-[10px] text-muted-foreground truncate">{church?.name || "Your Church"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-3 mb-2">Mobile header</p>
                <div className="bg-card border border-border/40 rounded-xl px-3 py-2.5 flex items-center gap-2 w-56">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: themeForm.accent_color + "33" }}>
                    {themeForm.logo_url ? (
                      <img src={themeForm.logo_url} alt="logo preview" className="w-full h-full object-cover scale-[1.35]" />
                    ) : (
                      <Music className="w-3.5 h-3.5" style={{ color: themeForm.accent_color }} />
                    )}
                  </div>
                  <span className="text-xs font-bold text-foreground">Dianoose Stage</span>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Colors */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Theme Colors</h2>
            </div>

            <p className="text-xs text-muted-foreground mb-4 font-medium">Quick Presets</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
              {PRESET_THEMES.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:scale-105 ${themeForm.accent_color === preset.primary ? "border-foreground/50 bg-secondary/50" : "border-border/30 hover:border-border/60"}`}
                >
                  <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: preset.primary, boxShadow: `0 0 12px ${preset.glow}60` }} />
                  <span className="text-[10px] font-semibold text-muted-foreground">{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                <Label className="text-xs font-bold text-foreground block mb-3">Accent Color</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-border cursor-pointer hover:scale-105 transition-transform shrink-0">
                    <input type="color" value={themeForm.accent_color} onChange={e => setT("accent_color", e.target.value)} className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Primary</p>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase">{themeForm.accent_color}</p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                <Label className="text-xs font-bold text-foreground block mb-3">Glow Color</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-border cursor-pointer hover:scale-105 transition-transform shrink-0">
                    <input type="color" value={themeForm.glow_color} onChange={e => setT("glow_color", e.target.value)} className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Glow</p>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase">{themeForm.glow_color}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="mt-4 p-4 rounded-xl border border-border/30 bg-background/40">
              <p className="text-xs text-muted-foreground mb-3 font-medium">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: themeForm.accent_color + "20", boxShadow: `0 0 16px ${themeForm.glow_color}40` }}>
                  <div className="w-5 h-5 rounded-md" style={{ backgroundColor: themeForm.accent_color }} />
                </div>
                <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: themeForm.accent_color + "30" }}>
                  <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: themeForm.accent_color }} />
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: themeForm.accent_color }}>
                  Button
                </div>
              </div>
            </div>

            <Button onClick={saveTheme} disabled={themeSaving} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold px-6">
              {themeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Branding</>}
            </Button>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2"><User className="w-4 h-4" /> My Profile</h2>
              <SaveBar saving={profileSaving} saved={profileSaved} />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">First Name</Label><Input value={profileForm.first_name} onChange={e => setP("first_name", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">Last Name</Label><Input value={profileForm.last_name} onChange={e => setP("last_name", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              </div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Instrument / Role</Label><Input value={profileForm.instrument} onChange={e => setP("instrument", e.target.value)} placeholder="Lead Guitar, Keys, Vocals..." className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground ml-1 block mb-2">Avatar Color</Label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setP("avatar_color", c)} className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${profileForm.avatar_color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : "hover:scale-105"}`}>
                      <span style={{ backgroundColor: c }} className="w-7 h-7 rounded-full block" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={saveProfile} disabled={profileSaving} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold px-6">
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Update Profile</>}
            </Button>
          </div>

          <div className="glass-panel rounded-2xl p-6 border-destructive/20">
            <h2 className="text-base font-bold text-destructive mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger Zone</h2>
            <p className="text-xs text-muted-foreground mb-4">Removing your account will delete your member profile. This cannot be undone.</p>
            {!showDeleteConfirm ? (
              <Button onClick={() => setShowDeleteConfirm(true)} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 h-9 px-4 rounded-xl text-xs font-semibold">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete My Account
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-medium">Type <span className="font-bold">DELETE</span> below to confirm.</p>
                </div>
                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE to confirm" className="bg-background/50 border-destructive/40 text-foreground text-sm" />
                <div className="flex gap-2">
                  <Button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} variant="outline" className="flex-1 border-border/50 h-9 rounded-xl text-xs">Cancel</Button>
                  <Button onClick={deleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 rounded-xl text-xs font-bold">
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-base font-bold text-foreground mb-5">Change Password</h2>
            {pwError && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 mb-4">{pwError}</div>}
            {pwSaved && <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2"><Check className="w-3.5 h-3.5" /> Password updated!</div>}
            <div className="space-y-3">
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Current Password</Label><Input value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">New Password</Label><Input value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              <div><Label className="text-xs font-medium text-muted-foreground ml-1">Confirm New</Label><Input value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
            </div>
            <Button onClick={savePassword} disabled={pwSaving} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold px-6">
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
