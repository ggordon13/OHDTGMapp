import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Footprints, Flame, ShieldCheck } from "lucide-react";
import FireflyCanvas from "@/components/FireflyCanvas";

const features = [
  { icon: Scale, label: "Log weight & watch your trend line" },
  { icon: Utensils, label: "Track calories, protein & water" },
  { icon: Footprints, label: "Hit your daily step goals" },
  { icon: Flame, label: "Build a streak you don't want to break" },
];

const Login = () => {
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Surface OAuth errors Supabase appends to the redirect URL (e.g. ?error_description=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription = params.get("error_description") || hashParams.get("error_description");

    if (errorDescription) {
      toast.error(errorDescription.replace(/\+/g, " "));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="wood-bg flex min-h-screen items-center justify-center">
        <div className="animate-pulse font-display text-[hsl(35,30%,65%)]">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      toast.error(error.message || "Sign in failed. Please try again.");
      setIsSigningIn(false);
    }
    // On success the browser navigates away to Google, so no further state change is needed here.
  };

  return (
    <div className="wood-bg relative min-h-screen">
      <FireflyCanvas />
      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Branding / value proposition */}
        <div className="hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="game-banner game-banner-gold w-fit text-sm"
          >
            🎯 My 100 Days
          </motion.span>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-8"
          >
            <h1 className="font-display text-4xl font-bold leading-tight tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_4px_0_rgba(0,0,0,0.45)] xl:text-5xl">
              100 days is enough time to change everything.
            </h1>
            <p className="max-w-md font-semibold text-[hsl(35,30%,66%)]">
              A focused daily tracker for weight, nutrition and movement — leveled up like a game to
              keep you honest for the next 100 days, not just the next 10.
            </p>

            <ul className="space-y-3">
              {features.map(({ icon: Icon, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[hsl(22,45%,14%)] bg-gradient-to-b from-[hsl(26,36%,38%)] to-[hsl(24,40%,26%)] shadow-[0_2px_0_hsl(22,45%,12%)]">
                    <Icon className="h-4 w-4 text-[hsl(42,80%,72%)]" />
                  </span>
                  <span className="font-semibold text-[hsl(38,45%,88%)]">{label}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-xs font-bold uppercase tracking-wide text-[hsl(35,30%,55%)]"
          >
            Free to play · Your data stays yours
          </motion.p>
        </div>

        {/* Sign-in */}
        <div className="flex items-center justify-center px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="space-y-3 text-center">
              <span className="game-banner game-banner-gold mx-auto text-sm lg:hidden">🎯 My 100 Days</span>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] text-3xl shadow-[0_4px_0_hsl(33,75%,28%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]">
                👋
              </div>
              <h2 className="font-display text-3xl font-bold tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_3px_0_rgba(0,0,0,0.4)]">
                Welcome Back
              </h2>
              <p className="font-semibold text-[hsl(35,30%,66%)]">
                Sign in to pick up your streak right where you left off.
              </p>
            </div>

            <div className="game-panel space-y-4 p-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-[hsl(33,32%,52%)] bg-[hsl(40,50%,95%)] px-6 py-3 font-display text-sm font-semibold uppercase tracking-wide text-card-foreground shadow-[0_4px_0_hsl(33,32%,58%)] transition-[transform,box-shadow,filter] duration-100 hover:brightness-[1.03] active:translate-y-[3px] active:shadow-[0_1px_0_hsl(33,32%,58%)] disabled:pointer-events-none disabled:opacity-60"
              >
                {isSigningIn ? (
                  "Redirecting to Google..."
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <div className="game-tag flex items-start gap-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  We only use your Google account to sign you in and personalize your dashboard.
                  We never post on your behalf.
                </span>
              </div>
            </div>

            <p className="text-center text-xs font-semibold text-[hsl(35,30%,58%)]">
              By continuing you agree to track your progress honestly — the rest is up to you.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
