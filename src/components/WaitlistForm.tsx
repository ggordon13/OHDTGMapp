import { useState } from "react";
import { Loader2, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/telemetry";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Compact email capture for the landing page — builds the launch list. */
const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      toast.error("Please enter a valid email.");
      return;
    }
    setStatus("submitting");
    const { error } = await supabase.from("waitlist_emails").insert({ email: value });
    // A duplicate (unique violation) still means they're on the list — treat as success.
    if (error && (error as { code?: string }).code !== "23505") {
      setStatus("idle");
      toast.error("Couldn't add you — please try again.");
      return;
    }
    track("waitlist_joined");
    setStatus("done");
  };

  if (status === "done") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm font-bold text-[hsl(84,45%,60%)]">
        <Check className="h-4 w-4" strokeWidth={3} /> You're on the list — we'll be in touch!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-sm items-center gap-2">
      <div className="relative flex-1">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          required
          className="w-full rounded-xl border-2 border-[hsl(33,32%,52%)] bg-[hsl(40,50%,95%)] py-2.5 pl-9 pr-3 text-sm font-semibold text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(42,88%,55%)]"
        />
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-[hsl(26,50%,18%)] shadow-[0_3px_0_hsl(33,75%,28%)] transition hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_hsl(33,75%,28%)] disabled:pointer-events-none disabled:opacity-60"
      >
        {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Notify me"}
      </button>
    </form>
  );
};

export default WaitlistForm;
