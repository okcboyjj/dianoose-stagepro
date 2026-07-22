import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, AlertCircle, Loader2, Check, Eye, EyeOff } from "lucide-react";

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
    .auth-screen {
      min-height: 100dvh;
      padding-top: max(env(safe-area-inset-top, 0px), 1.5rem);
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 1.5rem);
    }
  `}</style>
);

export default function ResetPassword() {
  const [oobCode, setOobCode] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Firebase sends reset links with ?oobCode= (plus mode=resetPassword)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    if (!code) {
      setError("No reset token found in this link. Please request a new password reset email.");
    } else {
      setOobCode(code);
    }
  }, []);

  const handleReset = async () => {
    setError("");
    if (!password) { setError("Please enter a new password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      await base44.auth.resetPassword({ oobCode, newPassword: password });
      setSuccess(true);
      // After 2.5s redirect back to the app root
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("expired") || msg.includes("invalid") || msg.includes("not found") || msg.includes("object")) {
        setError("This reset link has expired or is invalid. Please request a new one from the login screen.");
      } else if (msg.includes("password")) {
        setError("Password does not meet requirements. Please use at least 6 characters.");
      } else {
        setError("Failed to reset password. Please request a new reset link and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen bg-background flex items-center justify-center relative overflow-hidden">
      <GlobalStyles />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" style={{ animation: 'floatA 12s ease-in-out infinite' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" style={{ animation: 'floatB 10s ease-in-out infinite 2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] mx-4 relative z-10"
      >
        <div className="glass-panel rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
              <Music className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Dianoose Stage</h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Set your new password below.</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-destructive">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground">Password updated!</p>
              <p className="text-xs text-muted-foreground">Redirecting you to the app…</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {!oobCode ? (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mt-2">
                    <button onClick={() => window.location.href = "/"} className="text-primary font-semibold hover:underline">← Back to Sign In</button>
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">New Password</Label>
                    <div className="relative mt-1.5">
                      <Input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        className="bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors pr-10"
                        onKeyDown={e => e.key === "Enter" && handleReset()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground ml-1">Confirm New Password</Label>
                    <Input
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      type="password"
                      className="mt-1.5 bg-background/50 border-border/50 text-foreground text-sm focus:bg-background transition-colors"
                      onKeyDown={e => e.key === "Enter" && handleReset()}
                    />
                  </div>
                  <Button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden mt-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Set New Password"}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Remembered it?{" "}
                    <button onClick={() => window.location.href = "/"} className="text-primary font-semibold hover:underline">Sign In</button>
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}