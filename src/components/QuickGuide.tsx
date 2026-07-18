import { type ReactNode } from "react";
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

/** Chunky icon medallion that fronts each topic card. */
const toneFace: Record<Tone, string> = {
  red: "from-[hsl(6,70%,62%)] to-[hsl(6,62%,50%)] border-[hsl(6,55%,30%)] shadow-[0_3px_0_hsl(6,55%,30%)] text-white",
  teal: "from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)] border-[hsl(178,50%,18%)] shadow-[0_3px_0_hsl(178,50%,18%)] text-white",
  leaf: "from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] border-[hsl(70,50%,22%)] shadow-[0_3px_0_hsl(70,50%,22%)] text-white",
  gold: "from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] border-[hsl(33,75%,28%)] shadow-[0_3px_0_hsl(33,75%,28%)] text-[hsl(26,50%,18%)]",
  purple: "from-[hsl(268,42%,60%)] to-[hsl(268,44%,46%)] border-[hsl(268,45%,28%)] shadow-[0_3px_0_hsl(268,45%,28%)] text-white",
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

const Card = ({
  icon: Icon,
  title,
  hint,
  tone = "teal",
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  tone?: Tone;
  children: ReactNode;
}) => (
  <div className="game-tag h-full p-4">
    <div className="flex items-start gap-3">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 bg-gradient-to-b ${toneFace[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-display text-lg font-bold leading-tight text-card-foreground">{title}</p>
        {hint && <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{hint}</p>}
      </div>
    </div>
    <div className="mt-3 space-y-2.5">{children}</div>
  </div>
);

const Section = ({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: LucideIcon;
  title: string;
  color: Tone;
  children: ReactNode;
}) => (
  <section className="space-y-3">
    <span className={`game-banner ${bannerColor[color]} !rotate-0 text-sm`}>
      <Icon className="h-4 w-4" />
      {title}
    </span>
    {children}
  </section>
);

/** The app's condensed handbook: how to run the system day to day. */
const QuickGuide = ({ open, onOpenChange, mustAcknowledge = false }: QuickGuideProps) => (
  <Dialog.Root open={open} onOpenChange={(v) => !mustAcknowledge && onOpenChange(v)}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        onEscapeKeyDown={(e) => mustAcknowledge && e.preventDefault()}
        onPointerDownOutside={(e) => mustAcknowledge && e.preventDefault()}
        onInteractOutside={(e) => mustAcknowledge && e.preventDefault()}
        className="game-panel fixed left-1/2 top-1/2 z-[60] flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[hsl(33,28%,62%)] px-7 pb-4 pt-6">
          <Dialog.Title className="font-display text-3xl font-bold text-card-foreground">
            {mustAcknowledge ? "Welcome! Read this first 📖" : "Quick Guide 📖"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
            {mustAcknowledge
              ? "A 2-minute rundown of how the system works before you start tracking."
              : "How to run the system day to day — revisit this whenever you lose track."}
          </Dialog.Description>
          {!mustAcknowledge && (
            <Dialog.Close className="absolute right-5 top-5 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none">
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          )}
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-6">
          <Section icon={Wrench} title="Develop the System" color="red">
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <Card icon={Scale} title="Track Weight Daily" hint="Recommended: a bathroom scale and a food weighing scale" tone="purple">
                <ul className="space-y-2.5">
                  <Bullet>
                    <Em>For accurate tracking:</Em> weigh yourself every morning <Em>before</Em> your first food
                    intake and <Em>after</Em> using the restroom.
                  </Bullet>
                  <Bullet>
                    Keep a consistent eating window — first intake <Chip>12:00 PM</Chip>, last intake{" "}
                    <Chip>8:00 PM</Chip>.
                  </Bullet>
                </ul>
              </Card>

              <Card
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
                    Estimating without weighing is fine — <Em>consistency</Em> and watching how your weight
                    responds are what matter.
                  </Bullet>
                  <Bullet>Track protein to preserve muscle — too little means you lose muscle instead of fat.</Bullet>
                  <Bullet>
                    Water <Chip>~250 mL</Chip> per glass supports hydration, metabolism and overall wellness.
                  </Bullet>
                </ul>
                <Callout>
                  If your calorie average gives you <strong>headaches, don't push through it.</strong> Adjust
                  your target right away — this usually hits people aiming at the minimum, so move nearer the{" "}
                  <strong>maximum</strong>.
                </Callout>
              </Card>

              <Card icon={Footprints} title="Activity Tracking" hint="Strava or Hevy work well for this" tone="teal">
                <ul className="space-y-2.5">
                  <Bullet>
                    Your daily step goal comes from your activity level. Hit it especially on days you go over
                    your maximum calorie target.
                  </Bullet>
                  <Bullet>
                    Strength training or sports <Em>at least once a week</Em> — it builds muscle and prevents
                    muscle loss.
                  </Bullet>
                </ul>
              </Card>

              <Card icon={TrendingDown} title="Scale not going down?" hint="Common causes besides eating over your calories" tone="red">
                <div className="flex flex-wrap gap-1.5">
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
                    <Em>Don't worry about Week 1.</Em> It's the awareness phase — you're working out what to
                    adjust. <Em>Weekly averages</Em> matter far more than any single day.
                  </Bullet>
                </ul>
              </Card>
            </div>
          </Section>

          <Section icon={Trophy} title="Celebrating Progress" color="gold">
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <Card icon={Star} title="What counts as a successful week" tone="gold">
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
                      Missed the calorie average? Still earn it by hitting <Em>both</Em> your step goal{" "}
                      <Em>and</Em> strength training.
                    </p>
                  </div>
                </div>
              </Card>

              <Card icon={Gift} title="Reward System" hint="Coming soon" tone="purple">
                <ul className="space-y-2.5">
                  <Bullet>Set a custom reward for every badge you earn.</Bullet>
                  <Bullet>You decide what you get or buy yourself for each milestone you hit.</Bullet>
                </ul>
              </Card>
            </div>
          </Section>

          <Section icon={NotebookPen} title="Additional Notes" color="teal">
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <Card icon={Salad} title="Eating smart" tone="leaf">
                <ul className="space-y-2.5">
                  <Bullet>
                    <Em>Avoid liquid calories.</Em> Zero-calorie sodas (Coke Zero, Pepsi Max, Rite'n Lite) or
                    plain water are fine.
                  </Bullet>
                  <Bullet>Protein supplements make hitting your protein target much easier.</Bullet>
                  <Bullet>
                    Buffets, samgyup and unli wings are <Em>still allowed</Em> 💖 — just balance your calories
                    across the week.
                  </Bullet>
                  <Bullet>
                    <Em>But</Em> if you're monitoring blood sugar, uric acid or cholesterol, stay disciplined
                    and eat moderately.
                  </Bullet>
                  <Bullet>
                    Carbs and fats aren't logged here, but understanding your macros still helps.
                  </Bullet>
                </ul>
              </Card>

              <Card icon={HeartHandshake} title="Mindset & motivation" tone="red">
                <ul className="space-y-2.5">
                  <Bullet>Use the charts to see your progress and stay motivated.</Bullet>
                  <Bullet>
                    It's fine to get reds and miss goals sometimes. What matters is <Em>consistency</Em> and
                    staying motivated for the long-term target.
                  </Bullet>
                  <Bullet>
                    This tracker works best with an <Em>accountability partner or group</Em> — reach out and
                    team up!
                  </Bullet>
                </ul>
              </Card>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t-2 border-[hsl(33,28%,62%)] px-7 py-4">
          <GameButton
            color={mustAcknowledge ? "leaf" : "wood"}
            size="lg"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {mustAcknowledge ? "Got it — let's go! 🚀" : "Close"}
          </GameButton>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default QuickGuide;
