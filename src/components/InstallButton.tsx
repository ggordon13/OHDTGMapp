import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import { canInstall, isStandalone, onInstallAvailabilityChange, promptInstall } from "@/lib/pwa";
import { track } from "@/lib/telemetry";

/** "Install app" — appears only while the browser is actually offering install. */
const InstallButton = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const [show, setShow] = useState(canInstall());

  useEffect(() => onInstallAvailabilityChange(setShow), []);

  if (!show || isStandalone()) return null;

  const install = async () => {
    const accepted = await promptInstall();
    track("app_install_prompt", { accepted });
  };

  return (
    <GameButton color="forest" size={size} onClick={() => void install()} title="Install the app">
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install</span>
    </GameButton>
  );
};

export default InstallButton;
