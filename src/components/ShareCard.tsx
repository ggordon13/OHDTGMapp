import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CARD_HEIGHT, CARD_WIDTH, paintShareCard, prepareShareCard, type ShareCardData } from "@/lib/shareCardCanvas";

export type { ShareCardData };

/**
 * The branded progress card. It is painted onto a canvas rather than laid out
 * in the DOM, so what the user previews is byte-for-byte what gets exported —
 * see `lib/shareCardCanvas`.
 */
const ShareCard = forwardRef<HTMLCanvasElement, ShareCardData>(
  ({ name, level, streak, day, totalDays, pct }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

    useEffect(() => {
      let active = true;
      void prepareShareCard().then((assets) => {
        // Bail if the props changed (or we unmounted) while fonts were loading.
        if (active && canvasRef.current) {
          paintShareCard(canvasRef.current, { name, level, streak, day, totalDays, pct }, assets);
        }
      });
      return () => {
        active = false;
      };
    }, [name, level, streak, day, totalDays, pct]);

    return (
      <canvas
        ref={canvasRef}
        width={CARD_WIDTH * 2}
        height={CARD_HEIGHT * 2}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        className="block shrink-0"
        role="img"
        aria-label={`${name}'s progress: level ${level}, ${streak}-day streak, day ${day} of ${totalDays}`}
      />
    );
  },
);
ShareCard.displayName = "ShareCard";

export default ShareCard;
