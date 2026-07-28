import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Scale, Utensils, Footprints, Flame, ShieldCheck } from "lucide-react";
import FireflyCanvas from "@/components/FireflyCanvas";
import Logo from "@/components/Logo";
import WaitlistForm from "@/components/WaitlistForm";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
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
    <div className="wood-bg relative min-h-screen overflow-hidden px-4 py-12">
      <FireflyCanvas count={140} />

      <div ref={rootRef} className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mx-auto w-full max-w-xl space-y-6 text-center">
          {/* Floating brand badge — width-based so the wide logo fills the space. */}
          <Logo ref={medalRef} className="mx-auto h-auto w-72 sm:w-[26rem]" />

          <h1
            data-in
            className="font-display text-4xl font-bold leading-[1.05] tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_4px_0_rgba(0,0,0,0.45)] sm:text-5xl"
          >
            Level up your life,
            <br />
            <span className="text-[hsl(42,88%,62%)]">one day at a time.</span>
          </h1>

          <p data-in className="mx-auto max-w-md font-semibold text-[hsl(35,30%,66%)]">
            GGLvlup turns your weight, food and movement into a game of levels, streaks and trophies —
            so leveling up your life actually sticks.
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
            <GoogleSignInButton busy={isSigningIn} onClick={handleGoogleSignIn} />

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

        {/* Hover tour of what the app actually does. */}
        <FeatureShowcase />

        {/* Second ask, now that they've seen the goods. */}
        <section className="mx-auto mt-14 max-w-xl">
          <div className="game-panel space-y-4 p-6 text-center sm:p-8">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(24,55%,42%)]">
              Day 1 starts whenever you say
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-wide text-card-foreground">
              Ready to start your run?
            </h2>
            <p className="mx-auto max-w-sm text-sm font-semibold text-muted-foreground">
              Sign in and you'll be logging your first day in under a minute — Level 1, streak 0, a whole trophy case to
              fill. Free to play, no card, no setup wizard.
            </p>
            <div className="mx-auto max-w-sm">
              <GoogleSignInButton busy={isSigningIn} onClick={handleGoogleSignIn} label="Continue with Google" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Free to play · Your data stays yours
            </p>
          </div>
        </section>

        {/* Not ready to sign in? Capture the email for the launch list. */}
        <section className="mx-auto mt-10 max-w-sm space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-[hsl(35,30%,60%)]">
            Not ready yet? Get launch updates
          </p>
          <WaitlistForm />
        </section>

        <p className="mt-10 text-center text-xs font-semibold text-[hsl(35,30%,48%)]">
          <Link to="/privacy" className="hover:text-[hsl(42,88%,62%)]">Privacy</Link>
          <span className="mx-2">·</span>
          <Link to="/terms" className="hover:text-[hsl(42,88%,62%)]">Terms</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
