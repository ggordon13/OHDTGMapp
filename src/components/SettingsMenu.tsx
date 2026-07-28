import { useEffect, useState } from "react";
import { Palette, Settings, UserCog, Volume2, VolumeX } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isMuted, setMuted, sfx, subscribeMuted } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface SettingsMenuProps {
  size?: "sm" | "md" | "lg";
  onOpenThemes: () => void;
  onUpdateProfile: () => void;
}

const itemClass =
  "gap-2 rounded-lg px-2.5 py-2 font-display text-sm font-semibold text-card-foreground " +
  "focus:bg-[hsl(40,48%,88%)] focus:text-card-foreground cursor-pointer";

/**
 * The toolbar's overflow drawer. Themes, sound and profile are all
 * set-once-and-forget controls, so they live behind one button instead of
 * spending three slots in a row that has to survive on a phone.
 */
const SettingsMenu = ({ size = "sm", onOpenThemes, onUpdateProfile }: SettingsMenuProps) => {
  const [soundOff, setSoundOff] = useState(isMuted);

  useEffect(() => subscribeMuted(setSoundOff), []);

  const toggleSound = () => {
    const next = !soundOff;
    setMuted(next);
    // Unmuting previews the coin so the choice is audible right away.
    if (!next) sfx.claim();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GameButton color="wood" size={size} title="Settings">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </GameButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="game-panel min-w-[13rem] border-2 p-1.5"
      >
        <DropdownMenuItem className={itemClass} onSelect={() => onUpdateProfile()}>
          <UserCog className="h-4 w-4 text-[hsl(24,55%,42%)]" />
          Update Profile
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={() => onOpenThemes()}>
          <Palette className="h-4 w-4 text-[hsl(268,44%,48%)]" />
          Themes
        </DropdownMenuItem>

        {/* Kept open on select: sound is the one item you may want to flip
            back and forth to hear the difference. */}
        <DropdownMenuItem
          className={itemClass}
          aria-pressed={!soundOff}
          onSelect={(e) => {
            e.preventDefault();
            toggleSound();
          }}
        >
          {soundOff ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4 text-[hsl(178,50%,34%)]" />
          )}
          Sound
          <span
            className={cn(
              "ml-auto rounded-full border px-2 py-0.5 font-display text-[10px] font-bold uppercase",
              soundOff
                ? "border-[hsl(33,28%,60%)] bg-[hsl(40,30%,86%)] text-muted-foreground"
                : "border-[hsl(178,50%,28%)] bg-[hsl(178,48%,44%)] text-white",
            )}
          >
            {soundOff ? "Off" : "On"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SettingsMenu;
