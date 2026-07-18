import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Scale, Utensils, Footprints, Flame, ShieldCheck } from "lucide-react";
import FireflyCanvas from "@/components/FireflyCanvas";
import Logo from "@/components/Logo";
import { floatIdle, shine } from "@/lib/fx";

const features = [
  { icon: Scale, label: "Weight trends" },
  { icon: Utensils, label: "Calories & protein" },
  { icon: Footprints, label: "Daily steps" },
  { icon: Flame, label: "Streaks" },
];

const Login = () => {
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const medalRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Staggered "curtain up" entrance, then let the medal bob and the card gleam.
  useEffect(() => {
    if (loading || user) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = rootRef.current;
    if (!root) return;

    const items = root.querySelectorAll("[data-in]");
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(medalRef.current, { scale: 0, rotate: -35, duration: 0.7, ease: "back.out(2.2)" })
      .from(items, { y: 26, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.35");

    const stopFloat = floatIdle(medalRef.current, 4);
    const shineTimer = window.setTimeout(() => shine(cardRef.current), 1100);

    return () => {
      tl.kill();
      stopFloat();
      window.clearTimeout(shineTimer);
    };
  }, [loading, user]);

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
    <div className="wood-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <FireflyCanvas count={140} />

      <div ref={rootRef} className="relative z-10 w-full max-w-xl space-y-6 text-center">
        {/* Floating brand badge */}
        <Logo ref={medalRef} className="mx-auto h-36 w-36 sm:h-44 sm:w-44" />

        <h1
          data-in
          className="font-display text-4xl font-bold leading-[1.05] tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_4px_0_rgba(0,0,0,0.45)] sm:text-5xl"
        >
          Level up your fitness,
          <br />
          <span className="text-[hsl(42,88%,62%)]">one day at a time.</span>
        </h1>

        <p data-in className="mx-auto max-w-md font-semibold text-[hsl(35,30%,66%)]">
          A daily tracker for weight, food and movement — turned into a game of levels, streaks and
          trophies so you stick with it for the long haul.
        </p>

        {/* Feature chips */}
        <div data-in className="flex flex-wrap items-center justify-center gap-2">
          {features.map(({ icon: Icon, label }) => (
            <span key={label} className="game-tag inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-[hsl(24,55%,42%)]" />
              {label}
            </span>
          ))}
        </div>

        {/* Sign-in card */}
        <div data-in ref={cardRef} className="game-panel mx-auto max-w-sm space-y-4 p-6">
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

          <div className="game-tag flex items-start gap-2 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              We only use your Google account to sign you in and personalize your dashboard.
              We never post on your behalf.
            </span>
          </div>
        </div>

        <p data-in className="text-xs font-bold uppercase tracking-wide text-[hsl(35,30%,55%)]">
          Free to play · Your data stays yours
        </p>
      </div>
    </div>
  );
};

export default Login;
