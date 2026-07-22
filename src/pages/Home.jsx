import { useState, useEffect, useRef, useCallback, lazy, Suspense, Component } from "react";
import { applyChurchTheme } from "@/lib/applyTheme.js";
import { SCROLL_FADE_STYLE } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Music, Home as HomeIcon, List, Star, Guitar, Users, Bell, Shield, Settings, LogOut, X, Plus, Search, RefreshCw, Save, Check, ArrowRight, AlertCircle, Loader2, Zap, Flame, Mail, Calendar, Globe, ChevronLeft, ScanLine } from "lucide-react";
const OCRImportModal = lazy(() => import("@/components/app/song/OCRImportModal.jsx"));
import MobileSelect from "@/components/ui/MobileSelect";
const GlobalSongLibrary = lazy(() => import("@/components/app/GlobalSongLibrary.jsx"));
const SongDetailModal = lazy(() => import("@/components/app/song/SongDetailModal.jsx"));
const SongPreviewModal = lazy(() => import("@/components/app/song/SongPreviewModal.jsx"));
// SpotifySearchModal removed — Spotify search is now integrated into GlobalSongLibrary

const ServicesSection = lazy(() => import("@/components/app/ServicesSection"));
const MyLibrarySection = lazy(() => import("@/components/app/MyLibrarySection"));
const MusicianSection = lazy(() => import("@/components/app/MusicianSection"));
const AdminSection = lazy(() => import("@/components/app/AdminSection"));
const SettingsSection = lazy(() => import("@/components/app/SettingsSection"));
const NotificationsSection = lazy(() => import("@/components/app/NotificationsSection"));
const MessageCenter = lazy(() => import("@/components/app/MessageCenter"));
const DashboardSection = lazy(() => import("@/components/app/DashboardSection"));
const InvitePanel = lazy(() => import("@/components/app/InvitePanel"));

const SongEntity = base44.entities.Song;
const ServiceEntity = base44.entities.Service;
const ChurchMemberEntity = base44.entities.ChurchMember;
const ChurchEntity = base44.entities.Church;
const MyLibrarySongEntity = base44.entities.MyLibrarySong;
const NotificationEntity = base44.entities.Notification;

// Recovers accounts left orphaned by an interrupted signup (Auth user created, but the
// church/member Firestore docs never got written — e.g. the app crashed or hung mid-setup).
// Without this, retrying "New Church" with the same email always fails with "already exists",
// and there's no way back in since no church means nothing for Sign In's "no_church" path to find.
async function registerOrRecoverOrphanedAccount(email, password) {
  try {
    return await base44.auth.register({ email, password });
  } catch (registerErr) {
    const msg = (registerErr?.message || "").toLowerCase();
    const alreadyExists = msg.includes("already") || msg.includes("exists") || msg.includes("registered") || msg.includes("duplicate") || msg.includes("taken");
    if (!alreadyExists) throw registerErr;

    let loginResult;
    try {
      loginResult = await base44.auth.loginViaEmailPassword(email, password);
    } catch {
      throw new Error("An account with this email already exists, but that password doesn't match it. Please go back and sign in instead.");
    }

    const existingMembers = await ChurchMemberEntity.filter({ user_id: loginResult.user.id });
    if (existingMembers.length > 0) {
      throw new Error("This account is already set up with a church. Please go back and sign in instead.");
    }
    return loginResult;
  }
}

class CatalogErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error) {
    console.error("Global Catalog crashed", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-300 mx-auto" />
        <div>
          <p className="text-sm font-bold text-foreground">Global Catalog could not load</p>
          <p className="text-xs text-muted-foreground mt-1">One catalog item or request caused the view to crash. Try again after refreshing.</p>
        </div>
        <Button type="button" onClick={() => window.location.reload()} className="bg-primary text-primary-foreground">
          Reload App
        </Button>
      </div>
    );
  }
}

// ─── Global Styles & Animations ───────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes floatA { 
      0%, 100% { transform: translateY(0) rotate(0deg); } 
      50% { transform: translateY(-20px) rotate(3deg); } 
    }
    @keyframes floatB { 
      0%, 100% { transform: translateY(0) rotate(0deg); } 
      50% { transform: translateY(-15px) rotate(-2deg); } 
    }
    @keyframes shimmer { 
      0% { background-position: 200% 0; } 
      100% { background-position: -200% 0; } 
    }
    .glass-panel {
      background: hsl(var(--card) / 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid hsl(var(--border) / 0.5);
    }
    button, a, [role="button"] {
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .mobile-bottom-nav {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .main-content-mobile {
      padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    }
    .mobile-header {
      padding-top: env(safe-area-inset-top, 0px);
    }
    .auth-screen {
      min-height: 100dvh;
      padding-top: max(env(safe-area-inset-top, 0px), 1.5rem);
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 1.5rem);
    }
    @keyframes ptr-spin {
      to { transform: rotate(360deg); }
    }
    .song-card {
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      will-change: transform;
    }
    .song-card:hover {
      border-color: hsl(var(--primary) / 0.55);
      box-shadow: 0 0 22px hsl(var(--primary) / 0.12), 0 8px 20px rgba(0,0,0,0.35);
      transform: translateY(-2px);
    }
    .song-card .top-glow {
      transition: opacity 0.15s;
    }
    .song-card:hover .top-glow {
      opacity: 1 !important;
    }
  `}</style>
);

// ─── Animated scroll reveal ───────────────────────────────────────────────────
const AnimatedElement = ({ children, className = "", delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay || 30);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div
      className={`${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0px)" : "translateY(18px)",
        transition: `opacity 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// ─── Pull To Refresh ──────────────────────────────────────────────────────────
function PullToRefresh({ onRefresh, children, isMessages }) {
  const startY = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const threshold = 72;

  const onTouchStart = (e) => { if (!refreshing) startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const el = e.currentTarget;
    if (el.scrollTop > 0) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setProgress(Math.min(dy / threshold, 1));
      setPulling(dy > 10);
    }
  };
  const onTouchEnd = async () => {
    const shouldRefresh = progress >= 1;
    setPulling(false);
    startY.current = null;
    if (shouldRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setProgress(0);
      }
    } else {
      setProgress(0);
    }
  };

  const showIndicator = pulling || refreshing;

  return (
    <div
      className={isMessages ? "flex-1 min-h-0 overflow-hidden relative flex flex-col" : "flex-1 overflow-y-auto relative"}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showIndicator && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-2 z-10 pointer-events-none">
          <div
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center"
            style={{ opacity: refreshing ? 1 : progress, transform: `scale(${refreshing ? 1 : 0.5 + progress * 0.5})` }}
          >
            <RefreshCw className="w-4 h-4 text-primary" style={{ animation: (refreshing || progress >= 1) ? 'ptr-spin 0.6s linear infinite' : 'none', transform: refreshing ? 'none' : `rotate(${progress * 360}deg)` }} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Notification Bell (mini dropdown, not a page navigation) ────────────────
function NotificationBell({ notifications, onMarkRead, onViewAll, mobile }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recent = [...notifications]
    .sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))
    .slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [open]);

  const buttonClass = mobile
    ? "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground active:bg-secondary transition-colors relative"
    : "w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative";

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setOpen(o => !o)} aria-label="View notifications" className={buttonClass}>
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && <span className={`absolute ${mobile ? "top-2.5 right-2.5" : "top-2 right-2.5"} w-2 h-2 rounded-full bg-primary animate-pulse`} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] glass-panel rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Notifications</p>
              {unreadCount > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{unreadCount} new</span>}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {recent.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-6 h-6 text-muted-foreground opacity-40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications yet.</p>
                </div>
              ) : (
                recent.map(n => (
                  <button
                    key={n.id}
                    onClick={() => onMarkRead(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border/20 last:border-0 hover:bg-secondary/40 transition-colors flex items-start gap-3 ${!n.is_read ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? "bg-primary shadow-md shadow-primary/50" : "bg-muted"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>{n.message}</p>
                      {n.created_date && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => { setOpen(false); onViewAll(); }}
              className="w-full text-center py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              View all notifications
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Auth state ───────────────────────────────────────────────────────────────
let globalUser = null;
let globalChurch = null;


// ─── Login Screen ─────────────────────────────────────────────────────────────
function VerifyEmailScreen({ email, onVerified, onSignOut }) {
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    setError(""); setResent(false); setChecking(true);
    try {
      const verified = await base44.auth.checkEmailVerified();
      if (verified) onVerified();
      else setError("Still not verified — open the link in the email, then try again.");
    } catch (e) {
      setError("Couldn't check verification status. Please try again.");
    } finally { setChecking(false); }
  };

  const handleResend = async () => {
    setError(""); setChecking(true);
    try {
      await base44.auth.sendVerificationEmail();
      setResent(true);
    } catch (e) {
      setError("Failed to resend. Please try again in a moment.");
    } finally { setChecking(false); }
  };

  return (
    <div className="auth-screen bg-background flex items-center justify-center relative overflow-hidden">
      <GlobalStyles />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[420px] mx-4 relative z-10">
        <div className="glass-panel rounded-2xl p-8 shadow-2xl shadow-black/40 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
            <Mail className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Verify your email</h1>
          <p className="text-xs text-muted-foreground mt-2 mb-6">
            We sent a verification link to <span className="text-foreground font-semibold">{email}</span>. Open it, then come back here.
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 text-left">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs font-medium text-destructive">{error}</p>
                </div>
              </motion.div>
            )}
            {resent && !error && (
              <motion.div key="ok" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5 text-left">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-medium text-primary">Verification email resent — check your inbox (and spam).</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={handleCheck} disabled={checking} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mb-3">
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : "I've Verified — Continue"}
          </Button>
          <button onClick={handleResend} disabled={checking} className="text-xs text-primary font-semibold hover:underline mb-4 block mx-auto">
            Resend verification email
          </button>
          <p className="text-[11px] text-muted-foreground">
            Wrong account?{" "}
            <button onClick={onSignOut} className="text-primary font-semibold hover:underline">Sign out</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function LoginScreen({ onAuth }) {
  const urlParams = new URLSearchParams(window.location.search);
  const joinCodeFromUrl = urlParams.get("join") || "";
  const [tab, setTab] = useState(joinCodeFromUrl ? "join" : "new"); // "signin" | "join" | "new"
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [joinCode, setJoinCode] = useState(joinCodeFromUrl);
  const [joinEmail, setJoinEmail] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [pendingVerifyUser, setPendingVerifyUser] = useState(null);

  // Covers a leftover signed-in-but-unverified session landing back on this screen.
  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        if (user && !user.emailVerified) setPendingVerifyUser(user);
      } catch {
        // Not signed in — normal case, nothing to do.
      }
    })();
  }, []);

  const proceedOrVerify = (user) => {
    if (!user.emailVerified) { setPendingVerifyUser(user); return; }
    onAuth();
  };

  // Shared by email/password sign-in and Google/Apple sign-in — both land here with a Firebase user.
  const resolveMemberAndEnter = async (user) => {
    const members = await ChurchMemberEntity.filter({ user_id: user.id });

    if (members.length > 0) {
      const churches = await ChurchEntity.filter({ id: members[0].church_id });
      globalUser = { ...user, ...members[0] };
      globalChurch = churches[0] || null;
      proceedOrVerify(user);
      return;
    }

    // No member profile — check if they're a church admin (incomplete setup)
    const adminChurches = await ChurchEntity.filter({ admin_user_id: user.id });
    if (adminChurches.length > 0) {
      const church = adminChurches[0];
      const nameParts = (user.full_name || "").trim().split(" ");
      const repairedMember = await ChurchMemberEntity.create({
        first_name: nameParts[0] || "Admin",
        last_name: nameParts.slice(1).join(" ") || "",
        email: user.email,
        role: "Admin",
        church_id: church.id,
        user_id: user.id,
        is_active: true
      });
      globalUser = { ...user, ...repairedMember };
      globalChurch = church;
      proceedOrVerify(user);
      return;
    }

    // Auth exists but no church at all — let them join or create one
    throw new Error("no_church");
  };

  const handleSignIn = async () => {
    setError(""); setLoading(true);
    try {
      const { user } = await base44.auth.loginViaEmailPassword(signInEmail.trim(), signInPassword);
      if (!user) throw new Error("bad_credentials");
      await resolveMemberAndEnter(user);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg === "bad_credentials" || msg.includes("invalid") || msg.includes("credentials") || msg.includes("incorrect") || msg.includes("unauthorized") || msg.includes("401")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg === "no_church") {
        setError("Your account isn't linked to a church yet. Use the 'Join My Church' tab to connect, or create a new workspace.");
      } else {
        setError("Sign in failed. Please check your connection and try again.");
      }
    } finally { setLoading(false); }
  };

  const handleSocialSignIn = async (providerMethod) => {
    setError(""); setLoading(true);
    try {
      const { user } = await base44.auth[providerMethod]();
      if (!user) throw new Error("bad_credentials");
      await resolveMemberAndEnter(user);
    } catch (e) {
      console.error(`Social sign-in failed: code=${e?.code} message=${e?.message}`);
      const msg = (e?.message || "").toLowerCase();
      if (msg === "no_church") {
        setError("Your account isn't linked to a church yet. Use the 'Join My Church' tab (with the email/password your admin gave you), or create a new workspace.");
      } else if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        // User closed the popup — not an error worth surfacing.
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    setError(""); setLoading(true);
    try {
      if (!joinCode.trim()) throw new Error("Please enter your team code.");
      if (!joinEmail.trim()) throw new Error("Please enter your email address.");
      if (!joinPassword.trim()) throw new Error("Please enter your password.");

      const churches = await ChurchEntity.filter({ team_code: joinCode.trim().toUpperCase() });
      if (churches.length === 0) throw new Error("That team code wasn't found. Double-check with your admin.");
      const church = churches[0];

      let user;
      try {
        const result = await base44.auth.loginViaEmailPassword(joinEmail.trim(), joinPassword);
        user = result.user;
        if (!user) throw new Error("bad_credentials");
      } catch (loginErr) {
        const loginMsg = (loginErr?.message || "").toLowerCase();
        const noSuchAccount = loginMsg.includes("user-not-found") || loginMsg.includes("invalid-credential") || loginMsg.includes("no user record");
        if (noSuchAccount) {
          // First time joining — this becomes their new account.
          const result = await base44.auth.register({ email: joinEmail.trim(), password: joinPassword });
          user = result.user;
        } else {
          throw loginErr;
        }
      }

      await completeJoin(user, church);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg === "bad_credentials" || msg.includes("invalid") || msg.includes("credentials") || msg.includes("incorrect") || msg.includes("unauthorized") || msg.includes("401")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg.includes("team code") || msg.includes("wasn't found")) {
        setError(e.message);
      } else if (msg.includes("please enter")) {
        setError(e.message);
      } else {
        setError("Could not join the church workspace. Please check your details and try again.");
      }
    } finally { setLoading(false); }
  };

  const handleSocialJoin = async (providerMethod) => {
    setError(""); setLoading(true);
    try {
      if (!joinCode.trim()) throw new Error("Please enter your team code.");
      const churches = await ChurchEntity.filter({ team_code: joinCode.trim().toUpperCase() });
      if (churches.length === 0) throw new Error("That team code wasn't found. Double-check with your admin.");
      const church = churches[0];

      const { user } = await base44.auth[providerMethod]();
      if (!user) throw new Error("bad_credentials");
      await completeJoin(user, church);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        // User closed the sheet — not an error worth surfacing.
      } else if (msg.includes("team code") || msg.includes("wasn't found") || msg.includes("please enter")) {
        setError(e.message);
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const completeJoin = async (user, church) => {
    // Check if already a member
    const existing = await ChurchMemberEntity.filter({ church_id: church.id, user_id: user.id });
    if (existing.length > 0) {
      globalUser = { ...user, ...existing[0] };
      globalChurch = church;
      proceedOrVerify(user);
      return;
    }
    // New member — create profile and link to church
    const nameParts = (user.full_name || "").trim().split(" ");
    const newMember = await ChurchMemberEntity.create({
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      email: user.email,
      role: "Musician",
      church_id: church.id,
      user_id: user.id,
      is_active: true
    });
    globalUser = { ...user, ...newMember };
    globalChurch = church;
    proceedOrVerify(user);
  };

  const handleForgotPassword = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (!resetEmail.trim()) throw new Error("Please enter your email address.");
      await base44.auth.resetPasswordRequest(resetEmail.trim());
      setSuccess("Password reset email sent! Check your inbox (and spam folder).");
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("not found") || msg.includes("no user") || msg.includes("exist")) {
        setError("No account found with that email address.");
      } else {
        setError(msg || "Failed to send reset email. Please try again.");
      }
    } finally { setLoading(false); }
  };

  if (pendingVerifyUser) {
    return (
      <VerifyEmailScreen
        email={pendingVerifyUser.email}
        onVerified={onAuth}
        onSignOut={async () => { await base44.auth.logout(); setPendingVerifyUser(null); }}
      />
    );
  }

  if (showSetup) return <SetupWizard onDone={onAuth} onBack={() => setShowSetup(false)} />;

  return (
    <div className="auth-screen bg-background flex items-center justify-center relative">
      <GlobalStyles />
      {/* Deep ambient radial glow matching screenshot */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden sm:block" style={{ animation: 'floatA 12s ease-in-out infinite' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen hidden sm:block" style={{ animation: 'floatB 10s ease-in-out infinite 2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px] mx-4 relative z-10"
      >
        <div className="glass-panel rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
              <Music className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Dianoose Stage</h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">The Modern Command Center for Worship Teams.</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-background/60 rounded-lg p-1 mb-6 border border-border/40 backdrop-blur-md">
            {[{ id: "signin", label: "Sign In" }, { id: "join", label: "Join My Church" }, { id: "new", label: "New Church" }].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(""); setSuccess(""); setShowForgotPassword(false); }}
                className={`flex-1 text-[11px] uppercase tracking-wider py-2.5 rounded-md font-bold transition-all duration-300 ${tab === t.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs font-medium text-destructive">{error}</p>
                </div>
              </motion.div>
            )}
            {success && (
              <motion.div key="ok" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-medium text-primary">{success}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tab === "signin" && !showForgotPassword && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground ml-1">Email Address</Label>
                <Input value={signInEmail} onChange={e => setSignInEmail(e.target.value)} placeholder="you@yourchurch.com" type="email" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium text-muted-foreground ml-1">Password</Label>
                  <button
                    onClick={() => { setShowForgotPassword(true); setResetEmail(signInEmail); setError(""); setSuccess(""); }}
                    className="text-[11px] text-primary hover:underline font-semibold transition-all"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="••••••••" type="password" className="bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors" onKeyDown={e => e.key === "Enter" && handleSignIn()} />
              </div>
              <Button onClick={handleSignIn} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
              </Button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialSignIn("signInWithGoogle")}
                  disabled={loading}
                  className="h-11 rounded-xl text-xs font-semibold border border-border/50 bg-background/50 text-foreground hover:bg-background transition-colors disabled:opacity-50"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialSignIn("signInWithApple")}
                  disabled={loading}
                  className="h-11 rounded-xl text-xs font-semibold border border-border/50 bg-background/50 text-foreground hover:bg-background transition-colors disabled:opacity-50"
                >
                  Continue with Apple
                </button>
              </div>
            </motion.div>
          )}

          {tab === "signin" && showForgotPassword && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Reset your password</p>
                <p className="text-xs text-muted-foreground mb-4">Enter your email and we'll send you a reset link.</p>
                <Label className="text-xs font-medium text-muted-foreground ml-1">Email Address</Label>
                <Input value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@yourchurch.com" type="email" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors" onKeyDown={e => e.key === "Enter" && handleForgotPassword()} />
              </div>
              <Button onClick={handleForgotPassword} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Email"}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
              </Button>
              <button onClick={() => { setShowForgotPassword(false); setError(""); setSuccess(""); }} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                ← Back to Sign In
              </button>
            </motion.div>
          )}

          {tab === "join" && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground ml-1">Team Join Code</Label>
                <Input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Paste code from your admin" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm font-mono uppercase focus:bg-background transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialJoin("signInWithGoogle")}
                  disabled={loading}
                  className="h-11 rounded-xl text-xs font-semibold border border-border/50 bg-background/50 text-foreground hover:bg-background transition-colors disabled:opacity-50"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialJoin("signInWithApple")}
                  disabled={loading}
                  className="h-11 rounded-xl text-xs font-semibold border border-border/50 bg-background/50 text-foreground hover:bg-background transition-colors disabled:opacity-50"
                >
                  Continue with Apple
                </button>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or use email</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground ml-1">Your Email</Label>
                <Input value={joinEmail} onChange={e => setJoinEmail(e.target.value)} placeholder="you@yourchurch.com" type="email" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground ml-1">Password</Label>
                <Input value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="Choose a password (or enter your existing one)" type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors" />
              </div>
              <Button onClick={handleJoin} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join My Church"}
              </Button>
            </motion.div>
          )}

          {tab === "new" && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 transition-all hover:bg-accent/15">
                <div className="flex items-center gap-2 mb-1.5">
                  <Flame className="w-4 h-4 text-accent" />
                  <p className="text-sm font-bold text-foreground">Starting fresh?</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set up your church workspace in 2 minutes. You'll become the admin and can add your whole team after.
                </p>
              </div>
              <Button onClick={() => setShowSetup(true)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 opacity-70" />
                Set Up My Church <ArrowRight className="w-4 h-4 opacity-70" />
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
              </Button>
              <p className="text-[11px] text-center text-muted-foreground mt-4">
                Already set up?{" "}
                <button onClick={() => setTab("signin")} className="text-primary font-semibold hover:underline transition-all">Sign In</button>
                {" "}or{" "}
                <button onClick={() => setTab("join")} className="text-primary font-semibold hover:underline transition-all">Join your church</button>
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
function SetupWizard({ onDone, onBack }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(null);
  const [data, setData] = useState({
    churchName: "", city: "", state: "", website: "",
    serviceDay: "Sunday", serviceTime: "10:00", serviceName: "Morning Worship", timezone: "Eastern (ET)",
    accentColor: "#6C63FF", appIcon: "music",
    firstName: "", lastName: "", email: "", instrument: "", password: "", confirmPassword: ""
  });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  
  const appIcons = [
    { id: "music", icon: Music },
    { id: "home", icon: HomeIcon },
    { id: "guitar", icon: Guitar },
    { id: "star", icon: Star },
    { id: "shield", icon: Shield },
    { id: "users", icon: Users },
  ];

  const steps = [
    { title: "Welcome to Dianoose Stage", icon: Music, subtitle: "Set up your church workspace in 2 minutes." },
    { title: "Service Schedule", icon: Calendar, subtitle: "When is your main weekly service?" },
    { title: "Customize Your App", icon: Zap, subtitle: "Pick your church's accent color and icon." },
    { title: "Create Admin Account", icon: Shield, subtitle: "This is your main administrator account." }
  ];

  const completeWorkspaceSetup = async (user, overrides = {}) => {
    const firstName = (overrides.firstName ?? data.firstName).trim();
    const lastName = (overrides.lastName ?? data.lastName).trim();
    const email = (overrides.email ?? data.email).trim();

    await base44.auth.updateMe({ full_name: `${firstName} ${lastName}` });

    const teamCode = [
      Math.random().toString(36).substring(2, 5),
      Math.random().toString(36).substring(2, 5)
    ].join("").toUpperCase().replace(/[^A-Z0-9]/g, "X").substring(0, 8);

    const church = await ChurchEntity.create({
      name: data.churchName.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      website: data.website.trim(),
      service_day: data.serviceDay,
      service_time: data.serviceTime,
      service_name: data.serviceName.trim(),
      timezone: data.timezone,
      accent_color: data.accentColor,
      app_icon: data.appIcon,
      team_code: teamCode,
      admin_user_id: user.id
    });

    const member = await ChurchMemberEntity.create({
      first_name: firstName,
      last_name: lastName,
      email,
      instrument: data.instrument.trim(),
      role: "Admin",
      church_id: church.id,
      is_active: true,
      user_id: user.id
    });

    globalUser = { ...user, ...member, full_name: `${firstName} ${lastName}` };
    globalChurch = church;
    if (!user.emailVerified) { setPendingVerifyEmail(user.email); return; }
    onDone();
  };

  const handleGoogleSignup = async () => {
    setError(""); setLoading(true);
    try {
      if (!data.churchName.trim()) throw new Error("Church name is required.");
      const { user } = await base44.auth.signInWithGoogle();
      const nameParts = (user.full_name || "").trim().split(" ").filter(Boolean);
      const firstName = data.firstName.trim() || nameParts[0] || "";
      const lastName = data.lastName.trim() || nameParts.slice(1).join(" ") || "";
      if (!firstName || !lastName) throw new Error("Please enter your first and last name.");
      await completeWorkspaceSetup(user, { firstName, lastName, email: user.email });
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        // User closed the sheet — not an error worth surfacing.
      } else if (msg.includes("church") || msg.includes("name")) {
        setError(e.message);
      } else {
        setError("Google sign-up failed. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const handleFinish = async () => {
    setError(""); setLoading(true);
    try {
      if (!data.firstName.trim() || !data.lastName.trim()) throw new Error("Please enter your first and last name.");
      if (!data.email.trim()) throw new Error("Please enter your email address.");
      if (!data.password) throw new Error("Please enter a password.");
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (data.password !== data.confirmPassword) throw new Error("Passwords don't match. Please re-enter.");
      if (!data.churchName.trim()) throw new Error("Church name is required.");

      const { user } = await registerOrRecoverOrphanedAccount(data.email.trim(), data.password);
      await completeWorkspaceSetup(user);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered") || msg.includes("duplicate") || msg.includes("taken")) {
        setError(e.message.includes("already") ? e.message : "An account with this email already exists. Please go back and sign in instead.");
      } else if (msg.includes("password") || msg.includes("match") || msg.includes("6 char")) {
        setError(e.message);
      } else if (msg.includes("name") || msg.includes("church") || msg.includes("email") || msg.includes("please")) {
        setError(e.message);
      } else {
        setError("Setup failed. Please check your connection and try again.");
      }
    } finally { setLoading(false); }
  };

  if (pendingVerifyEmail) {
    return (
      <VerifyEmailScreen
        email={pendingVerifyEmail}
        onVerified={onDone}
        onSignOut={async () => { await base44.auth.logout(); onBack(); }}
      />
    );
  }

  const CurrentIcon = steps[step].icon;

  return (
    <div className="auth-screen bg-background flex items-center justify-center relative overflow-hidden">
      <GlobalStyles />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden sm:block" style={{ animation: 'floatA 12s ease-in-out infinite' }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen hidden sm:block" style={{ animation: 'floatB 10s ease-in-out infinite 2s' }} />

      <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-lg mx-4 relative z-10">
        <div className="glass-panel rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Progress Bar */}
          <div className="flex h-1.5 bg-background/50">
            {steps.map((_, i) => (
              <div key={i} className={`flex-1 transition-all duration-500 ${i <= step ? "bg-primary" : "bg-transparent"}`} />
            ))}
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <motion.div key={step} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <CurrentIcon className="w-7 h-7 text-primary-foreground" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">{steps[step].title}</h2>
              <p className="text-xs text-muted-foreground mt-1.5">{steps[step].subtitle}</p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs font-medium text-destructive">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Church Name *</Label>
                    <Input value={data.churchName} onChange={e => set("churchName", e.target.value)} placeholder="e.g. Grace Community Church" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">City</Label>
                      <Input value={data.city} onChange={e => set("city", e.target.value)} placeholder="Austin" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">State</Label>
                      <Input value={data.state} onChange={e => set("state", e.target.value)} placeholder="TX" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Website (optional)</Label>
                    <Input value={data.website} onChange={e => set("website", e.target.value)} placeholder="https://yourchurch.com" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Service Day</Label>
                    <div className="mt-1.5">
                      <MobileSelect value={data.serviceDay} onChange={v => set("serviceDay", v)} options={["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Start Time</Label>
                      <Input type="time" value={data.serviceTime} onChange={e => set("serviceTime", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Service Name</Label>
                      <Input value={data.serviceName} onChange={e => set("serviceName", e.target.value)} placeholder="Morning Worship" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Timezone</Label>
                    <div className="mt-1.5">
                      <MobileSelect value={data.timezone} onChange={v => set("timezone", v)} options={["Eastern (ET)","Central (CT)","Mountain (MT)","Pacific (PT)","UTC"]} />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="bg-background/40 p-5 rounded-xl border border-border/30">
                    <Label className="text-xs font-bold text-foreground mb-3 block">Accent Color</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-border shadow-inner cursor-pointer hover:scale-105 transition-transform">
                        <input type="color" value={data.accentColor} onChange={e => set("accentColor", e.target.value)} className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Brand Color</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 uppercase">{data.accentColor}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-background/40 p-5 rounded-xl border border-border/30">
                    <Label className="text-xs font-bold text-foreground mb-3 block">App Icon</Label>
                    <div className="flex flex-wrap gap-3">
                      {appIcons.map(item => (
                        <button key={item.id} onClick={() => set("appIcon", item.id)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${data.appIcon === item.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:scale-105"}`}>
                          <item.icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">First Name *</Label>
                      <Input value={data.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Jordan" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Last Name *</Label>
                      <Input value={data.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Cole" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Instrument / Role</Label>
                    <Input value={data.instrument} onChange={e => set("instrument", e.target.value)} placeholder="e.g. Worship Leader, Lead Guitar" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignup}
                    disabled={loading}
                    className="w-full h-11 rounded-xl text-sm font-semibold border border-border/50 bg-background/50 text-foreground hover:bg-background transition-colors disabled:opacity-50"
                  >
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or use email</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Email Address *</Label>
                    <Input value={data.email} onChange={e => set("email", e.target.value)} placeholder="you@yourchurch.com" type="email" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Password *</Label>
                      <Input value={data.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground ml-1">Confirm *</Label>
                      <Input value={data.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="••••••••" type="password" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="flex gap-3 mt-8">
              <Button variant="outline" onClick={() => step === 0 ? onBack() : setStep(s => s - 1)} className="border-border/50 bg-background/50 text-foreground hover:bg-secondary h-11 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all">
                {step === 0 ? "Cancel" : "Back"}
              </Button>
              {step < 3 ? (
                <Button onClick={() => { setError(""); setStep(s => s + 1); }} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                  Continue →
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={loading} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden shadow-lg shadow-primary/20">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Launch Workspace"}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ church }) {
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [nextDate, setNextDate] = useState("");

  useEffect(() => {
    const getDayNum = (d) => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(d);
    const tick = () => {
      const now = new Date();
      const targetDay = getDayNum(church?.service_day || "Sunday");
      const [h, m] = (church?.service_time || "10:00").split(":").map(Number);
      let next = new Date(now);
      const diff = (targetDay - now.getDay() + 7) % 7;
      next.setDate(now.getDate() + (diff === 0 && (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) ? 7 : diff));
      next.setHours(h, m, 0, 0);
      setNextDate(next.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
      const delta = Math.max(0, Math.floor((next - now) / 1000));
      setTime({ days: Math.floor(delta / 86400), hours: Math.floor((delta % 86400) / 3600), mins: Math.floor((delta % 3600) / 60), secs: delta % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [church]);

  return (
    <div className="glass-panel bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-1.5 relative z-10">
        <HomeIcon className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">Next Service</span>
      </div>
      <p className="text-lg text-foreground font-semibold mb-1 relative z-10">{church?.service_name || "Morning Worship"}</p>
      <p className="text-xs text-muted-foreground mb-5 relative z-10 font-medium">{nextDate}</p>
      
      <div className="flex items-end gap-3 relative z-10">
        {[{ val: time.days, label: "Days" }, { val: time.hours, label: "Hours" }, { val: time.mins, label: "Mins" }, { val: time.secs, label: "Secs" }].map((item, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="text-center group">
              <div className="bg-background/80 backdrop-blur-md border border-border/50 rounded-xl w-14 h-16 flex items-center justify-center shadow-inner transition-transform group-hover:-translate-y-1 duration-300">
                <span className="text-2xl font-bold text-foreground tabular-nums">{String(item.val).padStart(2, "0")}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-semibold">{item.label}</div>
            </div>
            {i < 3 && <span className="text-primary/50 font-bold text-xl pb-6">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Modal Wrappers ───────────────────────────────────────────────────────────
const ModalWrapper = ({ children, onClose, title, actionButton }) => (
  <AnimatePresence>
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: "spring", duration: 0.5, bounce: 0.3 }} className="bg-card border border-border/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-50" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/20">
          <h3 className="font-bold text-foreground text-lg">{title}</h3>
          <div className="flex items-center gap-3">
            {actionButton}
            <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {children}
      </motion.div>
    </div>
  </AnimatePresence>
);

// ─── Song Modal ───────────────────────────────────────────────────────────────
function SongModal({ song, onClose, onSave, churchId }) {
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState({
    title: song?.title || "", artist: song?.artist || "", key: song?.key || "",
    bpm: song?.bpm || "", time_signature: song?.time_signature || "4/4", capo: song?.capo || 0,
    youtube_url: song?.youtube_url || "", chart_content: song?.chart_content || "",
    guitar_patch_notes: song?.guitar_patch_notes || "", keys_patch_notes: song?.keys_patch_notes || "",
    production_notes: song?.production_notes || "", rehearsal_notes: song?.rehearsal_notes || "",
    arrangement_notes: song?.arrangement_notes || "", is_favorite: song?.is_favorite || false,
    category: song?.category || "", tags: song?.tags || []
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, church_id: churchId };
      if (song?.id) await SongEntity.update(song.id, payload);
      else await SongEntity.create(payload);
      onSave();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const TABS = [
    { id: "details", label: "Details" },
    { id: "chart", label: "Chart" },
    { id: "patches", label: "Patches" },
    { id: "rehearsal", label: "Rehearsal" },
    { id: "prod", label: "Prod" },
  ];

  return (
    <ModalWrapper onClose={onClose} title={song?.id ? "Edit Song" : "New Song"} actionButton={
      <button onClick={() => set("is_favorite", !form.is_favorite)} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${form.is_favorite ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
        <Star className={`w-3.5 h-3.5 ${form.is_favorite ? "fill-yellow-500" : ""}`} />
        {form.is_favorite ? "Favorited" : "Favorite"}
      </button>
    }>
      <div className="flex gap-1 px-4 pt-3 pb-2 bg-secondary/10 border-b border-border/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto max-h-[60vh] p-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            {tab === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Title</Label><Input value={form.title} onChange={e => set("title", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Artist</Label><Input value={form.artist} onChange={e => set("artist", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Key</Label><Input value={form.key} onChange={e => set("key", e.target.value)} placeholder="G, A, Bb..." className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">BPM</Label><Input type="number" value={form.bpm} onChange={e => set("bpm", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Capo</Label><Input type="number" value={form.capo} onChange={e => set("capo", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Time Sig</Label><Input value={form.time_signature} onChange={e => set("time_signature", e.target.value)} className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                  <div><Label className="text-xs font-medium text-muted-foreground ml-1">Category</Label><Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Worship, Hymn..." className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                </div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">YouTube / Reference</Label><Input value={form.youtube_url} onChange={e => set("youtube_url", e.target.value)} placeholder="https://youtube.com/..." type="url" className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1">Tags (comma separated)</Label><Input value={(form.tags || []).join(", ")} onChange={e => set("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))} placeholder="worship, contemporary, anthem..." className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm" /></div>
              </div>
            )}
            {tab === "chart" && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground bg-secondary/30 rounded-lg p-3 border border-border/50 font-medium"><b className="text-foreground">[Verse 1]</b> = section header &nbsp;|&nbsp; <b className="text-foreground">G Em C D</b> = chord line &nbsp;|&nbsp; lyrics on next line</p>
                <Textarea value={form.chart_content} onChange={e => set("chart_content", e.target.value)} placeholder="Paste or type chart here..." rows={14} className="bg-background/50 border-border/50 text-foreground text-sm font-mono leading-relaxed resize-none focus:bg-background" />
              </div>
            )}
            {tab === "patches" && (
              <div className="space-y-5">
                <div><Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Guitar Patch Notes</Label><Textarea value={form.guitar_patch_notes} onChange={e => set("guitar_patch_notes", e.target.value)} placeholder="Guitar patches, effects chain, amp settings..." rows={5} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Keys / Piano</Label><Textarea value={form.keys_patch_notes} onChange={e => set("keys_patch_notes", e.target.value)} placeholder="Keys patches, sounds, presets..." rows={5} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" /></div>
              </div>
            )}
            {tab === "rehearsal" && (
              <div className="space-y-5">
                <div><Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Rehearsal Notes</Label><Textarea value={form.rehearsal_notes} onChange={e => set("rehearsal_notes", e.target.value)} placeholder="What to focus on in rehearsal, dynamics, transitions..." rows={6} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Arrangement Notes</Label><Textarea value={form.arrangement_notes} onChange={e => set("arrangement_notes", e.target.value)} placeholder="Song arrangement, section order, length, endings..." rows={6} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" /></div>
              </div>
            )}
            {tab === "prod" && (
              <div><Label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Production Notes</Label><Textarea value={form.production_notes} onChange={e => set("production_notes", e.target.value)} placeholder="Lighting cues, video notes, sound notes, stage plot..." rows={14} className="bg-background/50 border-border/50 text-foreground text-sm resize-none" /></div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-secondary/10">
        <Button variant="outline" onClick={onClose} className="border-border/50 text-foreground hover:bg-background h-10 px-6 rounded-lg hover:scale-105 transition-all">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
        </Button>
      </div>
    </ModalWrapper>
  );
}

// ─── Song Card ────────────────────────────────────────────────────────────────
function SongCard({ song, onEdit, onDelete, onPreview, preferredKey, onToggleFavorite }) {
  const sections = song.arrangement_sections || [];
  const displayKey = preferredKey || song.key;
  const extraSections = sections.length > 3 ? sections.length - 3 : 0;
  const artwork = song.artwork_url;
  const isML = song.language === "Malayalam";
  const isBI = song.language === "Mixed";
  const primaryTitle = (isML && song.malayalam_title) ? song.malayalam_title : song.title;
  const secondaryLine = isML || isBI
    ? (song.transliteration_title || (isML ? song.title : song.artist))
    : song.artist;

  const langBadgeMap = { Malayalam: { label: "ML", cls: "bg-orange-500/15 text-orange-300 border-orange-500/25" } };
  const langBadge = langBadgeMap[song.language];

  return (
    <div
      onClick={() => onPreview(song, 'chart')}
      className="song-card relative bg-[#1a1a2c] border border-white/10 rounded-xl p-4 flex flex-col gap-3 cursor-pointer group overflow-hidden"
    >
      {/* Subtle top glow line */}
      <div className="top-glow absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0" />

      {/* Header — artwork + title/artist + key/fav */}
      <div className="flex items-center gap-3">
        {/* Album artwork */}
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
          {artwork ? (
            <img src={artwork} alt={song.title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 text-muted-foreground opacity-40" />
          )}
        </div>

        {/* Title + artist */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-bold text-foreground truncate leading-tight group-hover:text-primary/90 transition-colors ${isML ? "font-[system-ui]" : ""}`}>{primaryTitle}</p>
            {langBadge && <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 shrink-0 ${langBadge.cls}`}>{langBadge.label}</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{secondaryLine}</p>
        </div>

        {/* Key badge + favorite */}
        <div className="flex items-center gap-1.5 shrink-0">
          {displayKey && (
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <span className="text-[10px] font-bold text-primary">{displayKey}</span>
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); onToggleFavorite?.(song); }} className="text-muted-foreground hover:text-yellow-400 transition-colors">
            <Star className={`w-4 h-4 ${song.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-1.5">
        {song.bpm && <span className="text-[10px] font-semibold bg-white/5 text-muted-foreground border border-white/8 rounded-full px-2.5 py-0.5">{song.bpm} BPM</span>}
        {song.time_signature && <span className="text-[10px] font-semibold bg-white/5 text-muted-foreground border border-white/8 rounded-full px-2.5 py-0.5">{song.time_signature}</span>}
        {Number(song.capo) > 0 && <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 rounded-full px-2.5 py-0.5">Capo {song.capo}</span>}
        {song.chart_content && <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 rounded-full px-2.5 py-0.5">Chart</span>}
        {song.verified_status === "Verified" && <span className="text-[9px] font-bold bg-green-500/15 text-green-300 border border-green-500/25 rounded-full px-2 py-0.5">✓</span>}
        {song.verified_status === "Needs Review" && <span className="text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25 rounded-full px-2 py-0.5">Review</span>}
        {(song.tags || []).includes('ocr-import') && <span className="text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25 rounded-full px-2 py-0.5">OCR</span>}
      </div>

      {/* Arrangement sections */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sections.slice(0, 4).map(s => (
            <span key={s} className="text-[10px] font-semibold bg-white/5 text-muted-foreground border border-white/8 rounded-md px-2 py-0.5">{s}</span>
          ))}
          {extraSections > 0 && (
            <span className="text-[10px] font-semibold bg-white/5 text-muted-foreground border border-white/8 rounded-md px-2 py-0.5">+{extraSections}</span>
          )}
        </div>
      )}

      {/* Action pills — deep link into tabs */}
      <div className="flex gap-1.5 pt-1 border-t border-white/8">
        <button
          onClick={e => { e.stopPropagation(); onEdit(song); }}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-white/4 hover:bg-white/10 rounded-lg py-1.5 transition-colors"
        >
          ⌘ Edit
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPreview(song, 'chart'); }}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary bg-white/4 hover:bg-primary/10 rounded-lg py-1.5 transition-colors"
        >
          Chart
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPreview(song, 'patches'); }}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-white/4 hover:bg-white/10 rounded-lg py-1.5 transition-colors"
        >
          Patch
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// Per-tab root sections for the bottom nav
const TAB_ROOTS = {
  dashboard: "dashboard",
  songs: "songs",
  services: "services",
  messages: "messages",
  settings: "settings",
};

// All non-root sections belong to the "settings" tab bucket on mobile
const SECTION_TO_TAB = {
  dashboard: "dashboard",
  songs: "songs",
  services: "services",
  messages: "messages",
  settings: "settings",
  mylibrary: "settings",
  musicians: "settings",
  notifications: "settings",
  admin: "settings",
  invite: "settings",
};

function MainApp({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive activeSection from URL path
  const getPathSection = () => {
    const path = location.pathname.slice(1); // Remove leading /
    return path || "dashboard";
  };
  const [activeSection, setActiveSection] = useState(getPathSection());
  
  // Per-tab navigation stacks: { tabId: [section, ...] }
  const [tabStacks, setTabStacks] = useState({
    dashboard: ["dashboard"],
    songs: ["songs"],
    services: ["services"],
    messages: ["messages"],
    settings: ["settings"],
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [songs, setSongs] = useState([]);
  const [services, setServices] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [myLibrary, setMyLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [editSong, setEditSong] = useState(null);
  const [previewSong, setPreviewSong] = useState(null);
  const [previewTab, setPreviewTab] = useState('chart');
  const [songSearch, setSongSearch] = useState("");
  const [songKeyFilter, setSongKeyFilter] = useState("All");
  const [songSort, setSongSort] = useState("recent");
  const [songLibTab, setSongLibTab] = useState("church");
  const [showOCRImport, setShowOCRImport] = useState(false);

  // React state for church so onChurchUpdate triggers re-renders
  const [church, setChurch] = useState(globalChurch);
  const user = globalUser;

  // Apply theme whenever church changes
  useEffect(() => { applyChurchTheme(church); }, [church]);
  const isAdmin = user?.role === "Admin" || user?.role === "Worship Leader";

  // Active tab derived from current section
  const activeTab = SECTION_TO_TAB[activeSection] || "settings";

  // Navigate within the app — updates URL, section, and the tab stack
  const navigateTo = (section) => {
    const tab = SECTION_TO_TAB[section] || "settings";
    setTabStacks(prev => {
      const stack = prev[tab] || [TAB_ROOTS[tab]];
      if (stack[stack.length - 1] === section) return prev;
      return { ...prev, [tab]: [...stack, section] };
    });
    setActiveSection(section);
    navigate(`/${section}`);
  };

  // Go back within current tab
  const goBack = () => {
    setTabStacks(prev => {
      const stack = prev[activeTab] || [];
      if (stack.length <= 1) return prev;
      const newStack = stack.slice(0, -1);
      const prevSection = newStack[newStack.length - 1];
      setActiveSection(prevSection);
      navigate(`/${prevSection}`);
      return { ...prev, [activeTab]: newStack };
    });
  };

  // Switch tab — if tapping the active tab, reset its stack to root
  const switchTab = (tabId) => {
    const root = TAB_ROOTS[tabId];
    if (activeTab === tabId) {
      setTabStacks(prev => ({ ...prev, [tabId]: [root] }));
      setActiveSection(root);
      navigate(`/${root}`);
    } else {
      const stack = tabStacks[tabId] || [root];
      const targetSection = stack[stack.length - 1];
      setActiveSection(targetSection);
      navigate(`/${targetSection}`);
    }
  };

  const canGoBack = (tabStacks[activeTab] || []).length > 1;

  const loadData = useCallback(async (section, showSpinner = false) => {
    section = section ?? activeSection;
    if (!church?.id) return;
    if (showSpinner) setLoading(true);
    const uid = user?.user_id || user?.id;
    try {
      // Always fetch songs + services (needed for dashboard stats too)
      // Fetch section-specific data only when needed
      const base = [
        SongEntity.filter({ church_id: church.id }),
        ServiceEntity.filter({ church_id: church.id }),
      ];
      const [s, svc] = await Promise.all(base);
      setSongs(s); setServices(svc);

      // Fetch heavier per-section data lazily
      if (["dashboard","musicians","admin","services"].includes(section)) {
        const m = await ChurchMemberEntity.filter({ church_id: church.id });
        setMembers(m);
      }
      if (["dashboard","notifications"].includes(section)) {
        const n = await NotificationEntity.filter({ user_id: uid });
        setNotifications(n);
      }
      if (["dashboard","mylibrary"].includes(section)) {
        const ml = await MyLibrarySongEntity.filter({ user_id: uid });
        setMyLibrary(ml);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [church?.id, activeSection]);

  const handleManualRefresh = async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try { await loadData(); } finally { setManualRefreshing(false); }
  };

  const markNotificationRead = async (n) => {
    if (n.is_read) return;
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    await NotificationEntity.update(n.id, { is_read: true });
  };

  // Load data for the current section whenever it changes (show spinner only on first load)
  const isFirstLoad = useRef(true);
  useEffect(() => {
    const spinner = isFirstLoad.current;
    isFirstLoad.current = false;
    loadData(activeSection, spinner);
  }, [church?.id, activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = [
    { id: "dashboard", icon: HomeIcon, label: "Dashboard", group: "Main" },
    { id: "services", icon: List, label: "Services", group: "Main" },
    { id: "songs", icon: Music, label: "Song Library", group: "Main" },
    { id: "messages", icon: Mail, label: "Messages", group: "Main" },
    { id: "mylibrary", icon: Star, label: "My Library", badge: myLibrary.length, group: "Personal" },
    { id: "musicians", icon: Users, label: "Musicians", group: "Team" },
    { id: "invite", icon: Users, label: "Invite Members", group: "Team" },
    { id: "notifications", icon: Bell, label: "Notifications", badge: notifications.filter(n => !n.is_read).length, group: "Other" },
    { id: "admin", icon: Shield, label: "Admin Panel", group: "Other" },
    { id: "settings", icon: Settings, label: "Settings", group: "Other" }
  ];

  // Sync URL with activeSection on location change
  useEffect(() => {
    const pathSection = getPathSection();
    if (pathSection !== activeSection) {
      setActiveSection(pathSection);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = [...new Set(navItems.map(n => n.group))];
  const avatarText = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || "?";

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"} bg-card border-r border-border/30 shadow-2xl z-20 relative`}>
      <div className="p-5 border-b border-border/30 flex items-center gap-4 bg-background/20">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 overflow-hidden ${church?.logo_url ? "bg-secondary/30 border border-border/30" : "bg-primary"}`}>
          {church?.logo_url ? (
            <img src={church.logo_url} alt="Church logo" className="w-full h-full object-cover scale-[1.35]" />
          ) : (
            <Music className="w-5 h-5 text-primary-foreground" />
          )}
        </div>
        <div className="overflow-hidden">
          <h2 className="text-sm font-bold text-foreground truncate">Dianoose Stage</h2>
          <span className="text-[11px] text-muted-foreground truncate block font-medium">{church?.name || "Your Church"}</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
        {groups.map((group, gi) => (
          <div key={group} className={gi > 0 ? "mt-6" : ""}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-2 font-bold">{group}</p>
            {navItems.filter(n => n.group === group).map(item => (
              <button
                key={item.id}
                onClick={() => { navigateTo(item.id); if (mobile) setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group ${activeSection === item.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 duration-300 ${activeSection === item.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge > 0 && <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center transition-colors ${activeSection === item.id ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-border/30 bg-background/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground shrink-0">{avatarText}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{user?.first_name} {user?.last_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{user?.role || "Member"}</p>
        </div>
        <button onClick={onLogout} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Logout"><LogOut className="w-4 h-4" /></button>
      </div>
    </div>
  );

  const renderContent = () => {
    const sectionFallback2 = (
      <div className="space-y-4 pb-12 animate-pulse">
        <div className="h-8 w-48 bg-white/5 rounded-xl" />
        <div className="h-4 w-72 bg-white/4 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-white/4 rounded-xl border border-white/6" />)}
        </div>
      </div>
    );

    if (activeSection === "dashboard") return (
      <Suspense fallback={sectionFallback2}>
        <DashboardSection
          church={church}
          user={user}
          songs={songs}
          services={services}
          members={members}
          myLibrary={myLibrary}
          notifications={notifications}
          onNavigate={navigateTo}
          onRefresh={loadData}
        />
      </Suspense>
    );

    if (activeSection === "songs") return (
      <div key="songs" className="space-y-6 pb-12">
        <AnimatedElement>
          <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Song Library</h1>
              <p className="text-sm text-muted-foreground font-medium">{songs.length} songs in library</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowOCRImport(true)} className="bg-white/8 border border-white/15 text-foreground hover:bg-white/12 h-10 rounded-xl font-semibold transition-colors">
                <ScanLine className="w-4 h-4 mr-2" /> Scan Chart
              </Button>
              <Button onClick={() => { setEditSong(null); setShowSongModal(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"><Plus className="w-4 h-4 mr-2" /> Add Song</Button>
            </div>
          </div>
        </AnimatedElement>

        {/* Tab switcher */}
        <div className="flex bg-secondary/30 rounded-xl p-1 border border-border/30 w-fit">
          {[{ id: "church", label: "My Songs", icon: Music }, { id: "global", label: "Global Catalog", icon: Globe }].map(t => (
            <button key={t.id} onClick={() => setSongLibTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${songLibTab === t.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {songLibTab === "global" ? (
          <CatalogErrorBoundary resetKey={`${songLibTab}-${songs.length}`}>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}>
              <GlobalSongLibrary churchId={church?.id} churchSongs={songs} onSongCloned={() => loadData("songs")} />
            </Suspense>
          </CatalogErrorBoundary>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-card border border-border/40 rounded-xl px-4 py-2.5 focus-within:border-primary/50 transition-all">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Search songs, artists, keys..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1" />
                </div>
                <select
                  value={songSort}
                  onChange={e => setSongSort(e.target.value)}
                  className="bg-card border border-border/40 rounded-xl px-3 py-2.5 text-xs text-foreground outline-none hover:border-primary/40 transition-all shrink-0"
                >
                  <option value="recent">Recently Added</option>
                  <option value="title">Title A–Z</option>
                  <option value="artist">Artist A–Z</option>
                  <option value="key">Key</option>
                  <option value="bpm_asc">BPM Low→High</option>
                  <option value="bpm_desc">BPM High→Low</option>
                  <option value="favorites">Favorites First</option>
                </select>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 pr-4" style={SCROLL_FADE_STYLE}>
                {["All", "★", "ML", "EN", "G", "A", "B", "C", "D", "E", "F"].map(k => (
                  <button key={k} onClick={() => setSongKeyFilter(k)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${songKeyFilter === k ? "bg-primary text-primary-foreground shadow-md" : `bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30 ${k === "ML" ? "hover:text-orange-300" : ""}`}`}>{k}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {songs.filter(s => {
                if (songKeyFilter === "★") return s.is_favorite;
                if (songKeyFilter === "ML") return s.language === "Malayalam";
                if (songKeyFilter === "EN") return !s.language || s.language === "English";
                const matchLang = songKeyFilter === "All" || s.key === songKeyFilter;
                const q = songSearch.toLowerCase();
                const matchSearch = !songSearch ||
                  s.title?.toLowerCase().includes(q) ||
                  s.malayalam_title?.toLowerCase().includes(q) ||
                  s.transliteration_title?.toLowerCase().includes(q) ||
                  s.artist?.toLowerCase().includes(q) ||
                  (s.tags || []).some(t => t.toLowerCase().includes(q));
                return matchSearch && matchLang;
              }).sort((a, b) => {
                if (songSort === "title") return (a.title || "").localeCompare(b.title || "");
                if (songSort === "artist") return (a.artist || "").localeCompare(b.artist || "");
                if (songSort === "key") return (a.key || "").localeCompare(b.key || "");
                if (songSort === "bpm_asc") return (Number(a.bpm) || 0) - (Number(b.bpm) || 0);
                if (songSort === "bpm_desc") return (Number(b.bpm) || 0) - (Number(a.bpm) || 0);
                if (songSort === "favorites") return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
                // "recent" — sort by created_date descending
                return new Date(b.created_date || 0) - new Date(a.created_date || 0);
              }).map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onEdit={() => { setEditSong(song); setShowSongModal(true); }}
                  onDelete={async () => { await SongEntity.delete(song.id); loadData(); }}
                  onPreview={(s, tab) => { setPreviewSong(s); setPreviewTab(tab || 'chart'); }}
                  onToggleFavorite={async (s) => { await SongEntity.update(s.id, { is_favorite: !s.is_favorite }); loadData(); }}
                />
              ))}
              {songs.filter(s => {
                if (songKeyFilter === "★") return s.is_favorite;
                if (songKeyFilter === "ML") return s.language === "Malayalam";
                if (songKeyFilter === "EN") return !s.language || s.language === "English";
                const matchLang = songKeyFilter === "All" || s.key === songKeyFilter;
                const q = songSearch.toLowerCase();
                const matchSearch = !songSearch ||
                  s.title?.toLowerCase().includes(q) ||
                  s.malayalam_title?.toLowerCase().includes(q) ||
                  s.transliteration_title?.toLowerCase().includes(q) ||
                  s.artist?.toLowerCase().includes(q) ||
                  (s.tags || []).some(t => t.toLowerCase().includes(q));
                return matchSearch && matchLang;
              }).length === 0 && songs.length > 0 && (
                <div className="text-center py-12 text-muted-foreground col-span-full">
                  <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No songs match this filter.</p>
                  <button onClick={() => { setSongSearch(""); setSongKeyFilter("All"); }} className="mt-3 text-xs font-semibold text-primary hover:underline min-h-[44px] inline-flex items-center">
                    Clear filters
                  </button>
                </div>
              )}
              {songs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground col-span-full">
                  <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No songs yet.</p>
                  <p className="text-xs mt-1">Browse the <button onClick={() => setSongLibTab("global")} className="text-primary underline min-h-[44px] inline-flex items-center">Global Catalog</button> to add songs instantly.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );

    const sectionFallback = (
      <div className="space-y-4 pb-12 animate-pulse">
        <div className="h-8 w-48 bg-white/5 rounded-xl" />
        <div className="h-4 w-72 bg-white/4 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-white/4 rounded-xl border border-white/6" />)}
        </div>
      </div>
    );

    if (activeSection === "services") return <AnimatedElement key="services"><Suspense fallback={sectionFallback}><ServicesSection church={church} songs={songs} services={services} members={members} currentUser={user} isAdmin={isAdmin} onRefresh={loadData} /></Suspense></AnimatedElement>;
    if (activeSection === "mylibrary") return <AnimatedElement key="mylibrary"><Suspense fallback={sectionFallback}><MyLibrarySection songs={songs} myLibrary={myLibrary} user={user} church={church} onRefresh={loadData} onPreviewSong={(s, tab) => { setPreviewSong(s); setPreviewTab(tab || 'chart'); }} /></Suspense></AnimatedElement>;
    if (activeSection === "musicians") return <AnimatedElement key="musicians"><Suspense fallback={sectionFallback}><MusicianSection members={members} isAdmin={isAdmin} onRefresh={loadData} /></Suspense></AnimatedElement>;
    if (activeSection === "notifications") return <AnimatedElement key="notifications"><Suspense fallback={sectionFallback}><NotificationsSection notifications={notifications} onRefresh={loadData} /></Suspense></AnimatedElement>;
    if (activeSection === "admin") return <AnimatedElement key="admin"><Suspense fallback={sectionFallback}><AdminSection church={church} members={members} onRefresh={loadData} onChurchUpdate={(updated) => { globalChurch = updated; setChurch(updated); }} /></Suspense></AnimatedElement>;
    if (activeSection === "messages") return (
      <div key="messages" className="h-full flex flex-col min-h-0">
        <Suspense fallback={sectionFallback}>
          <MessageCenter church={church} user={user} services={services} members={members} />
        </Suspense>
      </div>
    );

    if (activeSection === "invite") return (
      <AnimatedElement key="invite">
        <div className="space-y-4 pb-12">
          <h1 className="text-2xl font-bold text-foreground">Invite Members</h1>
          <Suspense fallback={sectionFallback}>
            <InvitePanel church={church} user={user} members={members} onRefresh={loadData} />
          </Suspense>
        </div>
      </AnimatedElement>
    );
    if (activeSection === "settings") return (
      <AnimatedElement key="settings"><Suspense fallback={sectionFallback}><SettingsSection
        church={church}
        user={user}
        onChurchUpdate={(updated) => { globalChurch = updated; setChurch(updated); }}
        onUserUpdate={(updated) => { globalUser = updated; }}
      /></Suspense></AnimatedElement>
    );
    return null;
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      <GlobalStyles />
      {/* App ambient background - hidden on mobile for perf */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none mix-blend-screen hidden sm:block" />
      
      {/* Desktop sidebar */}
      <div className="hidden sm:flex shrink-0"><Sidebar /></div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute inset-y-0 left-0 w-72 z-50">
              <Sidebar mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Desktop top bar */}
        <div className="hidden sm:flex items-center gap-4 px-6 py-4 border-b border-border/30 bg-background/50 backdrop-blur-md shrink-0 sticky top-0 z-30">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button onClick={handleManualRefresh} disabled={manualRefreshing} aria-label="Refresh data" className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-60" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${manualRefreshing ? "animate-spin" : ""}`} />
            </button>
            <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} onViewAll={() => navigateTo("notifications")} />
          </div>
        </div>

        {/* Mobile top header */}
        <div className="mobile-header sm:hidden flex items-center justify-between px-2 border-b border-border/30 bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-30" style={{ minHeight: 56 }}>
          {/* Left: back button or logo */}
          <div className="flex items-center" style={{ minWidth: 44 }}>
            {canGoBack ? (
              <button
                onClick={goBack}
                aria-label="Go back"
                className="flex items-center gap-1 min-w-[44px] min-h-[44px] px-2 text-primary font-semibold text-sm"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-xs">Back</span>
              </button>
            ) : (
              <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="w-11 h-11 flex items-center justify-center pl-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-md shadow-primary/20 overflow-hidden ${church?.logo_url ? "bg-secondary/30 border border-border/30" : "bg-primary"}`}>
                  {church?.logo_url ? (
                    <img src={church.logo_url} alt="logo" className="w-full h-full object-cover scale-[1.35]" />
                  ) : (
                    <Music className="w-3.5 h-3.5 text-primary-foreground" />
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Center: section title */}
          <span className="text-sm font-bold text-foreground flex-1 text-center">
            {navItems.find(n => n.id === activeSection)?.label || "Dianoose Stage"}
          </span>

          {/* Right: action buttons — refresh is pull-to-refresh only on mobile */}
          <div className="flex items-center gap-1" style={{ minWidth: 44 }}>
            <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} onViewAll={() => navigateTo("notifications")} mobile />
          </div>
        </div>
        
        <PullToRefresh onRefresh={() => loadData(activeSection)} isMessages={activeSection === "messages"}>
          <div className={activeSection === "messages" ? "flex flex-col min-h-0 h-full px-4 sm:px-8 pb-2 sm:pb-4 pt-4 sm:pt-8" : "p-4 sm:p-8 scrollbar-hide main-content-mobile sm:pb-8"}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={activeSection === "messages" ? "flex-1 min-h-0 flex flex-col" : ""}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </PullToRefresh>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/40">
        <div className="flex items-center justify-around px-1 pt-1">
          {[
            { id: "dashboard", icon: HomeIcon, label: "Home" },
            { id: "songs", icon: Music, label: "Songs" },
            { id: "services", icon: List, label: "Services" },
            { id: "messages", icon: Mail, label: "Messages" },
            { id: "settings", icon: Settings, label: "More" },
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] rounded-xl transition-all no-select ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-label={item.label}
              >
                <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>

      {showSongModal && (
        <Suspense fallback={null}>
          <SongDetailModal
            song={editSong}
            onClose={() => setShowSongModal(false)}
            onSave={() => { setShowSongModal(false); loadData(); }}
            churchId={church?.id}
          />
        </Suspense>
      )}
      {showOCRImport && (
        <Suspense fallback={null}>
          <OCRImportModal
            churchId={church?.id}
            onClose={() => setShowOCRImport(false)}
            onSaved={() => { setShowOCRImport(false); loadData(); }}
          />
        </Suspense>
      )}
      {previewSong && (
        <Suspense fallback={null}>
          <SongPreviewModal
            song={previewSong}
            initialTab={previewTab}
            onClose={() => setPreviewSong(null)}
            onEdit={(s) => { setPreviewSong(null); setEditSong(s); setShowSongModal(true); }}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isLoggedIn = await base44.auth.isAuthenticated();
        if (!isLoggedIn) { setChecking(false); return; }

        const user = await base44.auth.me();
        if (!user) { setChecking(false); return; }
        // Unverified session — fall through to LoginScreen, which will pick up the
        // still-signed-in-but-unverified user and show the verification gate itself.
        if (!user.emailVerified) { setChecking(false); return; }

        // Try to find an existing member profile for this user
        const members = await ChurchMemberEntity.filter({ user_id: user.id });

        if (members.length > 0) {
          // Normal path — member profile exists, load their church
          const churchList = await ChurchEntity.filter({ id: members[0].church_id });
          globalUser = { ...user, ...members[0] };
          globalChurch = churchList[0] || null;
          applyChurchTheme(globalChurch);
          setAuthed(true);
        } else {
          // Auth exists but no member profile yet.
          // Check if they're the admin of a church (created church but member record failed)
          const adminChurches = await ChurchEntity.filter({ admin_user_id: user.id });
          if (adminChurches.length > 0) {
            // Auto-repair: recreate missing admin member record
            const church = adminChurches[0];
            const nameParts = (user.full_name || "").trim().split(" ");
            const firstName = nameParts[0] || "Admin";
            const lastName = nameParts.slice(1).join(" ") || "";
            const repairedMember = await ChurchMemberEntity.create({
              first_name: firstName,
              last_name: lastName,
              email: user.email,
              role: "Admin",
              church_id: church.id,
              user_id: user.id,
              is_active: true
            });
            globalUser = { ...user, ...repairedMember };
            globalChurch = church;
            applyChurchTheme(globalChurch);
            setAuthed(true);
          }
          // If no church at all — fall through to login screen so user can join/create
        }
      } catch (e) {
        // Auth failed or network error — fall through to login screen
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, []);

  if (checking) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <GlobalStyles />
      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
        <Music className="w-8 h-8 text-primary-foreground" />
      </div>
    </div>
  );

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />;
  const handleLogout = async () => {
    globalUser = null;
    globalChurch = null;
    await base44.auth.logout();
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
    });
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/");
  };

  return <MainApp onLogout={handleLogout} />;
}
