import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Trash2, AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/telemetry";
import GameButton from "@/components/game/GameButton";
import { Input } from "@/components/ui/input";

/** Danger-zone control: permanently deletes the user's account via the
 *  delete-account edge function, after a typed confirmation. */
const DeleteAccountButton = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE" && !busy;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      const returned = (data as { error?: string } | null)?.error;
      if (error || returned) throw new Error(returned || error?.message || "Delete failed");
      track("account_deleted");
      toast.success("Your account and data have been deleted.");
      await signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || "Couldn't delete your account — try again.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-[hsl(6,55%,45%)]/40 bg-[hsl(6,60%,55%)]/[0.07] p-4">
      <p className="font-display text-sm font-bold text-[hsl(6,55%,42%)]">Danger zone</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        Permanently delete your account and all your data — logs, trophies, levels and challenges. This can't be undone.
      </p>
      <GameButton
        color="red"
        size="sm"
        className="mt-3"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </GameButton>

      <Dialog.Root open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="game-panel fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[hsl(6,55%,32%)] bg-gradient-to-b from-[hsl(6,70%,60%)] to-[hsl(6,62%,48%)]">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </span>
                <div>
                  <Dialog.Title className="font-display text-xl font-bold text-card-foreground">Delete your account?</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                    This permanently erases your profile, logs, trophies and challenges. It can't be undone.
                  </Dialog.Description>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-delete" className="text-xs font-bold text-muted-foreground">
                  Type <span className="font-display text-card-foreground">DELETE</span> to confirm
                </label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-2">
                <GameButton color="wood" size="sm" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
                  Cancel
                </GameButton>
                <GameButton color="red" size="sm" className="flex-1" disabled={!canConfirm} onClick={() => void handleDelete()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {busy ? "Deleting…" : "Delete forever"}
                </GameButton>
              </div>
            </div>

            <Dialog.Close
              disabled={busy}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none disabled:opacity-50"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default DeleteAccountButton;
