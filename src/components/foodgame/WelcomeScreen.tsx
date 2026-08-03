import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Play, X } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import WelcomeScene from "./WelcomeScene";

interface WelcomeScreenProps {
  onStart: () => void;
  onExit: () => void;
}

const TITLE = "FOOD TRACK";

/** Title screen: 3D food carousel behind a logo that slams together on load. */
const WelcomeScreen = ({ onStart, onExit }: WelcomeScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "back.out(2.4)" } })
        .from("[data-kicker]", { y: -24, opacity: 0, duration: 0.5 }, 0.15)
        .from("[data-letter]", { y: -90, opacity: 0, rotate: -25, duration: 0.7, stagger: 0.045 }, 0.25)
        .from("[data-tagline]", { y: 16, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.8)
        .from("[data-cta]", { y: 28, opacity: 0, scale: 0.85, duration: 0.55, stagger: 0.1 }, 0.95);

      // Idle shimmer once the title has landed.
      gsap.to("[data-letter]", {
        y: -7,
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: { each: 0.08, from: "start" },
        delay: 1.6,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-[inherit] px-6 py-14 text-center"
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 50% 10%, hsl(28 45% 26%), hsl(22 48% 12%) 70%), hsl(22 50% 9%)",
      }}
    >
      <WelcomeScene />

      <div className="relative z-10 flex flex-col items-center">
        <span
          data-kicker
          className="game-banner game-banner-purple mb-5 text-xs sm:text-sm"
        >
          GGLVLUP presents
        </span>

        {/* Letters are animated individually, but each word is its own nowrap
            group so a narrow phone breaks between words instead of mid-word.
            The size tracks the viewport so "FOOD TRACK" stays on one line. */}
        <h2 className="flex flex-wrap items-baseline justify-center gap-x-3 sm:gap-x-5" aria-label={TITLE}>
          {TITLE.split(" ").map((word, wordIndex) => (
            <span key={`${word}-${wordIndex}`} className="flex flex-nowrap gap-x-1 sm:gap-x-2">
              {word.split("").map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  data-letter
                  aria-hidden="true"
                  className="font-display text-[clamp(1.9rem,9.5vw,3rem)] font-bold uppercase leading-none text-[hsl(42,95%,68%)] [text-shadow:0_3px_0_hsl(24,60%,22%),0_6px_0_hsl(22,60%,14%),0_10px_20px_rgba(0,0,0,0.6)] sm:text-7xl"
                >
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </h2>

        <p
          data-tagline
          className="mt-5 max-w-md font-display text-sm font-semibold text-[hsl(38,45%,84%)] sm:text-base"
        >
          Build today's food diary one tasty decision at a time. Every bite becomes calories and protein — and the
          food is <em className="not-italic text-[hsl(42,95%,68%)]">not</em> happy about it.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <div data-cta>
            <GameButton color="gold" size="lg" className="px-10 text-lg" onClick={onStart}>
              <Play className="h-5 w-5" fill="currentColor" />
              Start Game
            </GameButton>
          </div>
          <div data-cta>
            <GameButton color="wood" size="lg" onClick={onExit}>
              <X className="h-5 w-5" />
              Exit
            </GameButton>
          </div>
        </div>

        <p className="mt-8 text-xs font-bold text-[hsl(38,30%,60%)]">
          Nutrition values from USDA FoodData Central (public domain)
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
