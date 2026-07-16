import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiProps {
  /** Bump this key/value to trigger a fresh burst (e.g. a milestone weight). */
  trigger: number | string | null;
  emojis?: string[];
}

const PARTICLE_COUNT = 28;

/** A dependency-free celebratory burst that overlays the screen and self-dismisses. */
const Confetti = ({ trigger, emojis = ["🎉", "⭐", "🔥", "💪", "🏆", "✨"] }: ConfettiProps) => {
  const [burst, setBurst] = useState<number | null>(null);

  useEffect(() => {
    if (trigger == null) return;
    setBurst(Date.now());
    const t = setTimeout(() => setBurst(null), 1800);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <AnimatePresence>
      {burst && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.25;
            const duration = 1.1 + Math.random() * 0.6;
            const drift = (Math.random() - 0.5) * 160;
            return (
              <motion.span
                key={`${burst}-${i}`}
                className="absolute text-xl"
                style={{ left: `${left}%`, top: "-5%" }}
                initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
                animate={{ y: "110vh", x: drift, opacity: [1, 1, 0], rotate: Math.random() * 720 - 360 }}
                transition={{ duration, delay, ease: "easeIn" }}
              >
                {emojis[i % emojis.length]}
              </motion.span>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
};

export default Confetti;
