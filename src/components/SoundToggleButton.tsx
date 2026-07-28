import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { isMuted, setMuted, sfx, subscribeMuted } from "@/lib/sfx";

/**
 * Mute switch for the reward sounds. The setting lives in localStorage, so it
 * survives reloads; turning sound back on previews the coin blip so the choice
 * is audible immediately (and doubles as the user gesture browsers require
 * before any audio can play).
 */
const SoundToggleButton = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const [off, setOff] = useState(isMuted);

  // Keep in sync if the setting is changed from somewhere else.
  useEffect(() => subscribeMuted(setOff), []);

  const toggle = () => {
    const next = !off;
    setMuted(next);
    if (!next) sfx.claim();
  };

  return (
    <GameButton
      color={off ? "wood" : "teal"}
      size={size}
      onClick={toggle}
      aria-pressed={!off}
      title={off ? "Turn reward sounds on" : "Turn reward sounds off"}
    >
      {off ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      <span className="hidden sm:inline">{off ? "Sound Off" : "Sound On"}</span>
    </GameButton>
  );
};

export default SoundToggleButton;
