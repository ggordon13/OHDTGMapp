import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Scale,
  Utensils,
  Footprints,
  TrendingDown,
  Gift,
  Star,
  NotebookPen,
  Wrench,
  Trophy,
  ExternalLink,
  AlertTriangle,
  Salad,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import GameButton from "@/components/game/GameButton";

interface QuickGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * First-run mode: the guide must be acknowledged before the tracker can be
   * used, so outside-click / Esc dismissal is disabled.
   */
  mustAcknowledge?: boolean;
}

type Tone = "red" | "teal" | "leaf" | "gold" | "purple";

const bannerColor: Record<Tone, string> = {
  red: "game-banner-red",
  teal: "game-banner-teal",
  leaf: "game-banner-leaf",
  gold: "game-banner-gold",
  purple: "game-banner-purple",
};

/** Chunky icon medallion that fronts each topic slide. */
const toneFace: Record<Tone, string> = {
  red: "from-[hsl(6,70%,62%)] to-[hsl(6,62%,50%)] border-[hsl(6,55%,30%)] shadow-[0_3px_0_hsl(6,55%,30%)] text-white",
  teal: "from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)] border-[hsl(178,50%,18%)] shadow-[0_3px_0_hsl(178,50%,18%)] text-white",
  leaf: "from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] border-[hsl(70,50%,22%)] shadow-[0_3px_0_hsl(70,50%,22%)] text-white",
  gold: "from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] border-[hsl(33,75%,28%)] shadow-[0_3px_0_hsl(33,75%,28%)] text-[hsl(26,50%,18%)]",
  purple: "from-[hsl(268,42%,60%)] to-[hsl(268,44%,46%)] border-[hsl(268,45%,28%)] shadow-[0_3px_0_hsl(268,45%,28%)] text-white",
};

/** Soft page tint behind each slide so chapters feel distinct as you swipe. */
const toneWash: Record<Tone, string> = {
  red: "from-[hsl(6,60%,96%)]",
  teal: "from-[hsl(178,45%,95%)]",
  leaf: "from-[hsl(70,50%,95%)]",
  gold: "from-[hsl(42,80%,95%)]",
  purple: "from-[hsl(268,45%,96%)]",
};

const Bullet = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-2.5 text-[15px] font-semibold leading-relaxed text-muted-foreground">
    <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-[hsl(24,55%,48%)]" />
    <span>{children}</span>
  </li>
);

const Em = ({ children }: { children: ReactNode }) => (
  <strong className="font-bold text-card-foreground">{children}</strong>
);

/** Inline value pill — makes numbers and times pop out of the prose. */
const Chip = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-block rounded-md border-[1.5px] border-[hsl(33,30%,58%)] bg-[hsl(40,50%,95%)] px-1.5 py-px font-display text-[0.9em] font-bold text-card-foreground">
    {children}
  </span>
);

/** Amber warning box for the things people most often get wrong. */
const Callout = ({ children }: { children: ReactNode }) => (
  <div className="flex gap-3 rounded-xl border-2 border-[hsl(40,70%,45%)] bg-[hsl(45,82%,88%)] p-3">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(30,80%,42%)]" />
    <p className="text-[15px] font-semibold leading-relaxed text-[hsl(30,55%,30%)]">{children}</p>
  </div>
);

/** Which chapter a slide belongs to — rendered as a small ribbon in the header. */
interface Chapter {
  icon: LucideIcon;
  label: string;
  color: Tone;
}

/**
 * One topic: chapter ribbon, a big medallion, title, and its points — all in a
 * single tight centered header so the ribbon reads as part of the card (not a
 * disconnected pill floating above it). Fronts each slide.
 */
const Topic = ({
  eyebrow,
  icon: Icon,
  title,
  hint,
  tone,
  children,
}: {
  eyebrow: Chapter;
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  tone: Tone;
  children: ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex flex-col items-center gap-2.5 text-center">
      <span className={`game-banner ${bannerColor[eyebrow.color]} !rotate-0 text-xs`}>
        <eyebrow.icon className="h-3.5 w-3.5" />
        {eyebrow.label}
      </span>
      <span
        className={`-mt-0.5 flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-gradient-to-b ${toneFace[tone]}`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-display text-2xl font-bold leading-tight text-card-foreground">{title}</p>
      {hint && <p className="text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

/** The three chapters the topic slides are grouped under. */
const CH_SYSTEM: Chapter = { icon: Wrench, label: "Develop the System", color: "red" };
const CH_PROGRESS: Chapter = { icon: Trophy, label: "Celebrating Progress", color: "gold" };
const CH_NOTES: Chapter = { icon: NotebookPen, label: "Additional Notes", color: "teal" };

/** A single carousel slide: chapter ribbon + topic, on a tone-washed page. */
interface Slide {
  tone: Tone;
  content: ReactNode;
}

const slides: Slide[] = [
  // ---- Intro ----------------------------------------------------------------
  {
    tone: "gold",
    content: (
      <div className="space-y-5 text-center">
        <span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 bg-gradient-to-b text-4xl ${toneFace.gold}`}>
          📖
        </span>
        <div className="space-y-1.5">
          <p className="font-display text-2xl font-bold text-card-foreground">Welcome! Here's the game plan 🎮</p>
          <p className="mx-auto max-w-md text-[15px] font-semibold leading-relaxed text-muted-foreground">
            A quick, swipeable rundown of how the tracker works. Three short chapters — tap <Em>Next</Em> or swipe
            through. Takes about 2 minutes.
          </p>
        </div>
        <div className="mx-auto grid max-w-sm gap-2 text-left">
          {[
            { icon: Wrench, label: "Develop the System", desc: "Track weight, food & activity", tone: "red" as Tone },
            { icon: Trophy, label: "Celebrate Progress", desc: "Successful weeks & rewards", tone: "gold" as Tone },
            { icon: NotebookPen, label: "Extra Notes", desc: "Eat smart, stay motivated", tone: "teal" as Tone },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-xl border-2 border-[hsl(33,28%,66%)] bg-[hsl(40,48%,94%)] p-2.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 bg-gradient-to-b ${toneFace[c.tone]}`}>
                <c.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-card-foreground">{c.label}</p>
                <p className="text-xs font-semibold text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ---- Chapter 1: Develop the System ---------------------------------------
  {
    tone: "purple",
    content: (
      <Topic
        eyebrow={CH_SYSTEM}
        icon={Scale}
        title="Track Weight Daily"
        tone="purple"
        hint="Recommended: a bathroom scale and a food weighing scale"
      >
          <ul className="space-y-2.5">
            <Bullet>
              <Em>For accurate tracking:</Em> weigh yourself every morning <Em>before</Em> your first food intake and{" "}
              <Em>after</Em> using the restroom.
            </Bullet>
            <Bullet>
              Set regular times for your first and last food/drink intake, then stick to them daily. The exact hours are
              up to you — <Em>for example</Em>, first intake <Chip>12:00 PM</Chip>, last intake <Chip>8:00 PM</Chip>.
            </Bullet>
          </ul>
      </Topic>
    ),
  },
  {
    tone: "leaf",
    content: (
      <Topic
        eyebrow={CH_SYSTEM}
        icon={Utensils}
        title="Food & Drink Tracking"
        tone="leaf"
        hint={
            <a
              href="https://www.myfitnesspal.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-card-foreground"
            >
              MyFitnessPal <ExternalLink className="h-3 w-3" />
            </a>
          }
        >
          <ul className="space-y-2.5">
            <Bullet>Weigh your food if you have a scale, and follow your calorie & protein targets as closely as you can.</Bullet>
            <Bullet>
              Estimating without weighing is fine — <Em>consistency</Em> and watching how your weight responds are what
              matter.
            </Bullet>
            <Bullet>Track protein to preserve muscle — too little means you lose muscle instead of fat.</Bullet>
            <Bullet>
              Water <Chip>~250 mL</Chip> per glass supports hydration, metabolism and overall wellness.
            </Bullet>
          </ul>
          <Callout>
            If your calorie average gives you <strong>headaches, don't push through it.</strong> Adjust your target right
            away — this usually hits people aiming at the minimum, so move nearer the <strong>maximum</strong>.
          </Callout>
      </Topic>
    ),
  },
  {
    tone: "teal",
    content: (
      <Topic eyebrow={CH_SYSTEM} icon={Footprints} title="Activity Tracking" tone="teal" hint="Strava or Hevy work well for this">
          <ul className="space-y-2.5">
            <Bullet>
              Your daily step goal comes from your activity level. Hit it especially on days you go over your maximum
              calorie target.
            </Bullet>
            <Bullet>
              Strength training or sports <Em>at least once a week</Em> — it builds muscle and prevents muscle loss.
            </Bullet>
          </ul>
      </Topic>
    ),
  },
  {
    tone: "red",
    content: (
      <Topic
        eyebrow={CH_SYSTEM}
        icon={TrendingDown}
        title="Scale not going down?"
        tone="red"
        hint="Common causes besides eating over your calories"
      >
          <div className="flex flex-wrap justify-center gap-1.5">
            {["Sodium / carbs / alcohol", "No restroom before weigh-in", "Water retention", "Stress (cortisol)", "Menstrual cycle", "Low thyroid", "Lack of sleep"].map((r) => (
              <span
                key={r}
                className="rounded-full border-[1.5px] border-[hsl(33,30%,58%)] bg-[hsl(40,50%,95%)] px-2.5 py-1 text-xs font-bold text-muted-foreground"
              >
                {r}
              </span>
            ))}
          </div>
          <ul className="space-y-2.5">
            <Bullet>
              <Em>Don't worry about Week 1.</Em> It's the awareness phase — you're working out what to adjust.{" "}
              <Em>Weekly averages</Em> matter far more than any single day.
            </Bullet>
          </ul>
      </Topic>
    ),
  },

  // ---- Chapter 2: Celebrating Progress -------------------------------------
  {
    tone: "gold",
    content: (
      <Topic eyebrow={CH_PROGRESS} icon={Star} title="What counts as a successful week" tone="gold">
          <div className="space-y-2.5">
            <div className="rounded-xl border-2 border-[hsl(70,45%,45%)] bg-[hsl(70,40%,88%)] p-3">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-[hsl(70,45%,30%)]">Option 1</p>
              <p className="mt-1 text-[15px] font-semibold leading-relaxed text-muted-foreground">
                Hit your <Em>calorie average</Em>, plus <Em>any 2</Em> of protein, water, steps or strength.
              </p>
            </div>
            <div className="rounded-xl border-2 border-[hsl(70,45%,45%)] bg-[hsl(70,40%,88%)] p-3">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-[hsl(70,45%,30%)]">Option 2</p>
              <p className="mt-1 text-[15px] font-semibold leading-relaxed text-muted-foreground">
                Missed the calorie average? Still earn it by hitting <Em>both</Em> your step goal <Em>and</Em> strength
                training.
              </p>
            </div>
          </div>
      </Topic>
    ),
  },
  {
    tone: "purple",
    content: (
      <Topic eyebrow={CH_PROGRESS} icon={Gift} title="Reward System" tone="purple" hint="Coming soon">
          <ul className="space-y-2.5">
            <Bullet>Set a custom reward for every badge you earn.</Bullet>
            <Bullet>You decide what you get or buy yourself for each milestone you hit.</Bullet>
          </ul>
      </Topic>
    ),
  },

  // ---- Chapter 3: Additional Notes -----------------------------------------
  {
    tone: "leaf",
    content: (
      <Topic eyebrow={CH_NOTES} icon={Salad} title="Eating smart" tone="leaf">
          <ul className="space-y-2.5">
            <Bullet>
              <Em>Avoid liquid calories.</Em> Zero-calorie sodas (Coke Zero, Pepsi Max, Rite'n Lite) or plain water are
              fine.
            </Bullet>
            <Bullet>Protein supplements make hitting your protein target much easier.</Bullet>
            <Bullet>
              Buffets, samgyup and unli wings are <Em>still allowed</Em> 💖 — just balance your calories across the week.
            </Bullet>
            <Bullet>
              <Em>But</Em> if you're monitoring blood sugar, uric acid or cholesterol, stay disciplined and eat
              moderately.
            </Bullet>
            <Bullet>Carbs and fats aren't logged here, but understanding your macros still helps.</Bullet>
          </ul>
      </Topic>
    ),
  },
  {
    tone: "red",
    content: (
      <Topic eyebrow={CH_NOTES} icon={HeartHandshake} title="Mindset & motivation" tone="red">
          <ul className="space-y-2.5">
            <Bullet>Use the charts to see your progress and stay motivated.</Bullet>
            <Bullet>
              It's fine to get reds and miss goals sometimes. What matters is <Em>consistency</Em> and staying motivated
              for the long-term target.
            </Bullet>
            <Bullet>
              This tracker works best with an <Em>accountability partner or group</Em> — reach out and team up!
            </Bullet>
          </ul>
      </Topic>
    ),
  },

  // ---- Outro ----------------------------------------------------------------
  {
    tone: "leaf",
    content: (
      <div className="space-y-5 text-center">
        <span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 bg-gradient-to-b text-4xl ${toneFace.leaf}`}>
          🚀
        </span>
        <div className="space-y-1.5">
          <p className="font-display text-2xl font-bold text-card-foreground">You're all set!</p>
          <p className="mx-auto max-w-md text-[15px] font-semibold leading-relaxed text-muted-foreground">
            Log daily, chase your <Em>weekly averages</Em>, and let the trophies and level-ups pile up. Consistency beats
            perfection — every single day.
          </p>
        </div>
        <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-1.5">
          {["Weigh in each morning", "Follow your targets", "Win the week", "Team up with a buddy"].map((r) => (
            <span
              key={r}
              className="rounded-full border-[1.5px] border-[hsl(70,45%,45%)] bg-[hsl(70,40%,90%)] px-2.5 py-1 text-xs font-bold text-[hsl(70,45%,28%)]"
            >
              ✓ {r}
            </span>
          ))}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Revisit this guide anytime from the menu.</p>
      </div>
    ),
  },
];

/** The app's condensed handbook, as an easy swipeable carousel. */
const QuickGuide = ({ open, onOpenChange, mustAcknowledge = false }: QuickGuideProps) => {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = slides.length - 1;
  const isLast = index === last;

  // Always start at the beginning each time the guide is opened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const go = (n: number) => setIndex(Math.min(last, Math.max(0, n)));
  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx <= -50) next();
    else if (dx >= 50) prev();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !mustAcknowledge && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onEscapeKeyDown={(e) => mustAcknowledge && e.preventDefault()}
          onPointerDownOutside={(e) => mustAcknowledge && e.preventDefault()}
          onInteractOutside={(e) => mustAcknowledge && e.preventDefault()}
          onKeyDown={onKeyDown}
          className="game-panel fixed left-1/2 top-1/2 z-[60] flex h-[92vh] max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:h-[88vh] sm:max-h-[88vh]"
        >
          {/* Header */}
          <div className="shrink-0 border-b-2 border-[hsl(33,28%,62%)] px-6 pb-3 pt-5">
            <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
              {mustAcknowledge ? "Welcome! Read this first 📖" : "Quick Guide 📖"}
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm font-semibold text-muted-foreground">
              Swipe or tap through — no long scrolling.
            </Dialog.Description>
            {!mustAcknowledge && (
              <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            )}
            {/* Progress bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(37,30%,80%)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(42,90%,55%)] to-[hsl(30,80%,48%)] transition-all duration-300"
                style={{ width: `${((index + 1) / slides.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Carousel viewport */}
          <div className="relative min-h-0 flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div
              className="flex h-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((s, i) => (
                <div
                  key={i}
                  aria-hidden={i !== index}
                  className={`h-full w-full shrink-0 overflow-y-auto bg-gradient-to-b to-transparent px-6 py-6 ${toneWash[s.tone]}`}
                >
                  <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center">{s.content}</div>
                </div>
              ))}
            </div>

            {/* Edge arrows (desktop, hidden on the extremes) */}
            {index > 0 && (
              <button
                type="button"
                onClick={prev}
                aria-label="Previous"
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border-2 border-[hsl(33,28%,55%)] bg-[hsl(40,50%,96%)]/90 p-1.5 text-card-foreground shadow-sm transition hover:bg-[hsl(40,50%,92%)] sm:flex"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border-2 border-[hsl(33,28%,55%)] bg-[hsl(40,50%,96%)]/90 p-1.5 text-card-foreground shadow-sm transition hover:bg-[hsl(40,50%,92%)] sm:flex"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Footer: dots + primary action */}
          <div className="shrink-0 space-y-3 border-t-2 border-[hsl(33,28%,62%)] px-6 py-4">
            <div className="flex items-center justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={
                    i === index
                      ? "h-2 w-5 rounded-full bg-[hsl(30,80%,48%)] transition-all"
                      : "h-2 w-2 rounded-full bg-[hsl(33,28%,72%)] transition-all hover:bg-[hsl(33,28%,60%)]"
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <GameButton color="wood" size="lg" className="flex-1" disabled={index === 0} onClick={prev}>
                <ChevronLeft className="h-4 w-4" /> Back
              </GameButton>
              {isLast ? (
                <GameButton color={mustAcknowledge ? "leaf" : "gold"} size="lg" className="flex-[1.4]" onClick={() => onOpenChange(false)}>
                  {mustAcknowledge ? "Got it — let's go! 🚀" : "Done 🎉"}
                </GameButton>
              ) : (
                <GameButton color="leaf" size="lg" className="flex-[1.4]" onClick={next}>
                  Next <ChevronRight className="h-4 w-4" />
                </GameButton>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default QuickGuide;
