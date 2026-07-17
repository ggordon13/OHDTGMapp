import { useEffect } from "react";
import { confettiBurst } from "@/lib/fx";

interface ConfettiProps {
  /** Bump this key/value to trigger a fresh burst (e.g. a milestone weight). */
  trigger: number | string | null;
}

/** GSAP-powered celebratory burst; spawns and cleans up its own DOM. */
const Confetti = ({ trigger }: ConfettiProps) => {
  useEffect(() => {
    if (trigger == null) return;
    confettiBurst(null, 36);
  }, [trigger]);

  return null;
};

export default Confetti;
