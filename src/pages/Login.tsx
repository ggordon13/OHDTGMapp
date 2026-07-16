import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Utensils, Droplets, Footprints, Flame, ShieldCheck } from "lucide-react";

const features = [
  { icon: Scale, label: "Log weight & see your trend line" },
  { icon: Utensils, label: "Track calories, protein & water" },
  { icon: Footprints, label: "Hit your daily step goals" },
  { icon: Flame, label: "Build a streak you don't want to break" },
];

const Login = () => {
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Branding / value proposition panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-accent p-12 text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_45%)]" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <span className="font-display text-lg font-semibold tracking-tight">My 100 Days</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 space-y-8"
        >
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            100 days is enough time to change everything.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            A focused daily tracker for weight, nutrition and movement — built to keep you
            honest for the next 100 days, not just the next 10.
          </p>

          <ul className="space-y-3">
            {features.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative z-10 text-xs text-primary-foreground/70"
        >
          Free to use. Your data stays yours.
        </motion.p>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 space-y-2 text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold tracking-tight lg:hidden">My 100 Days</h1>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">
              Sign in to pick up your streak right where you left off.
            </p>
          </div>

          <Card className="border-border/60 shadow-lg">
            <CardContent className="space-y-4 p-6">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                size="lg"
                className="w-full gap-2"
              >
                {isSigningIn ? (
                  "Redirecting to Google..."
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  We only use your Google account to sign you in and personalize your dashboard.
                  We never post on your behalf.
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:text-left">
            By continuing you agree to track your progress honestly — the rest is up to you.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
