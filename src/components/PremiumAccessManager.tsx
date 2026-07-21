import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldCheck, CalendarClock, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { canManageAccess, normalizeAccessLevel, normalizeRole, type PremiumAllowlistEntry } from "@/lib/access";
import { toast } from "sonner";

interface ProfileRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  access_level: string | null;
  role: string | null;
  challenge_start_date: string | null;
  pending_challenge_start_date: string | null;
}

/** One row of the directory — a real user, or an allowlist-only "invite". */
interface DirectoryRow {
  key: string;
  email: string;
  displayName: string | null;
  userId: string | null;
  accessLevel: "free" | "premium";
  role: "user" | "admin" | "dev";
  day1: string | null;
  pendingDay1: string | null;
  /** An active premium allowlist grant exists for this email. */
  allowlistActive: boolean;
  allowlistId?: string;
  /** True when there's no signed-up profile yet (allowlist invite only). */
  inviteOnly: boolean;
}

const PremiumAccessManager = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [allowlist, setAllowlist] = useState<PremiumAllowlistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<"free" | "premium">("premium");
  const [filter, setFilter] = useState("");
  // Draft Day 1 value per user, keyed by user_id, while the admin edits it.
  const [day1Draft, setDay1Draft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManage = useMemo(() => canManageAccess(profile?.role ?? undefined), [profile?.role]);

  const load = useCallback(async () => {
    const [{ data: profileData }, { data: allowData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, email, display_name, access_level, role, challenge_start_date, pending_challenge_start_date")
        .order("email", { ascending: true }),
      supabase.from("premium_allowlist").select("*").order("email", { ascending: true }),
    ]);
    setProfiles((profileData ?? []) as ProfileRow[]);
    setAllowlist((allowData ?? []) as PremiumAllowlistEntry[]);
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  // Merge profiles (all signed-up users) with allowlist grants into one list.
  const rows = useMemo<DirectoryRow[]>(() => {
    const byEmail = new Map<string, PremiumAllowlistEntry>();
    for (const entry of allowlist) byEmail.set(entry.email.trim().toLowerCase(), entry);

    const seen = new Set<string>();
    const directory: DirectoryRow[] = profiles.map((p) => {
      const key = (p.email ?? p.user_id).trim().toLowerCase();
      seen.add(key);
      const grant = p.email ? byEmail.get(p.email.trim().toLowerCase()) : undefined;
      return {
        key,
        email: p.email ?? "(no email)",
        displayName: p.display_name,
        userId: p.user_id,
        accessLevel: normalizeAccessLevel(p.access_level),
        role: normalizeRole(p.role),
        day1: p.challenge_start_date,
        pendingDay1: p.pending_challenge_start_date,
        allowlistActive: !!grant && grant.is_active !== false,
        allowlistId: grant?.id,
        inviteOnly: false,
      };
    });

    // Allowlist emails with no matching profile yet — invited, not signed up.
    for (const entry of allowlist) {
      const key = entry.email.trim().toLowerCase();
      if (seen.has(key)) continue;
      directory.push({
        key,
        email: entry.email,
        displayName: null,
        userId: null,
        accessLevel: normalizeAccessLevel(entry.access_level),
        role: "user",
        day1: null,
        pendingDay1: null,
        allowlistActive: entry.is_active !== false,
        allowlistId: entry.id,
        inviteOnly: true,
      });
    }

    const q = filter.trim().toLowerCase();
    const filtered = q ? directory.filter((r) => r.email.toLowerCase().includes(q) || (r.displayName ?? "").toLowerCase().includes(q)) : directory;
    return filtered.sort((a, b) => a.email.localeCompare(b.email));
  }, [profiles, allowlist, filter]);

  // Pre-grant premium to an email (works before the user has signed up).
  const handleAdd = async () => {
    if (!user || !email.trim()) return;
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase
      .from("premium_allowlist")
      .upsert({ email: normalizedEmail, access_level: accessLevel, is_active: true }, { onConflict: "email" });
    setLoading(false);
    if (!error) {
      setEmail("");
      setAccessLevel("premium");
      await load();
    } else {
      toast.error("Couldn't add that email.");
    }
  };

  // Grant / revoke premium. The allowlist is the source of truth the login-time
  // resolver reconciles to; we also write the profile so the change shows now.
  const togglePremium = async (row: DirectoryRow, grant: boolean) => {
    setBusyKey(row.key);
    const emailKey = row.email.trim().toLowerCase();

    const { error: grantError } = grant
      ? await supabase.from("premium_allowlist").upsert(
          { email: emailKey, access_level: "premium", is_active: true },
          { onConflict: "email" },
        )
      : row.allowlistId
        ? await supabase.from("premium_allowlist").update({ is_active: false }).eq("id", row.allowlistId)
        : { error: null };

    if (grantError) {
      setBusyKey(null);
      toast.error("Couldn't update premium access.");
      return;
    }

    // Reflect immediately on the user's profile (admins stay premium by role).
    if (row.userId && row.role === "user") {
      await supabase.from("profiles").update({ access_level: grant ? "premium" : "free" }).eq("user_id", row.userId);
    }

    setBusyKey(null);
    toast.success(grant ? `${row.email} is now premium 👑` : `${row.email} moved to free.`);
    await load();
  };

  const removeInvite = async (row: DirectoryRow) => {
    if (!row.allowlistId) return;
    setBusyKey(row.key);
    const { error } = await supabase.from("premium_allowlist").delete().eq("id", row.allowlistId);
    setBusyKey(null);
    if (error) toast.error("Couldn't remove the invite.");
    else await load();
  };

  // Propose a Day 1 change; the user approves it on their next login.
  const proposeDay1 = async (row: DirectoryRow) => {
    if (!row.userId) return;
    const draft = day1Draft[row.userId];
    if (!draft || draft === row.day1) {
      toast.info("Pick a different date to propose a change.");
      return;
    }
    setBusyKey(row.key);
    const { error } = await supabase
      .from("profiles")
      .update({ pending_challenge_start_date: draft })
      .eq("user_id", row.userId);
    setBusyKey(null);
    if (error) {
      toast.error("Couldn't propose the change.");
      return;
    }
    toast.success(`Proposed Day 1 = ${draft}. ${row.email} will be asked to approve it.`);
    await load();
  };

  const cancelDay1 = async (row: DirectoryRow) => {
    if (!row.userId) return;
    setBusyKey(row.key);
    const { error } = await supabase
      .from("profiles")
      .update({ pending_challenge_start_date: null })
      .eq("user_id", row.userId);
    setBusyKey(null);
    if (error) toast.error("Couldn't cancel the proposal.");
    else await load();
  };

  if (!canManage) return null;

  return (
    <Card className="border-[hsl(38,60%,90%)]/20 bg-card/80 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-[hsl(42,95%,62%)]" />
          Access Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pre-grant premium by email (works before the user signs up). */}
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Pre-grant an email (user@example.com)"
            className="md:max-w-xs"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={accessLevel}
            onChange={(event) => setAccessLevel(event.target.value as "free" | "premium")}
          >
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </select>
          <Button onClick={handleAdd} disabled={loading || !email.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Filter the directory. */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search users by email or name"
            className="pl-9"
          />
        </div>

        {/* Unified directory: every user (free + premium) plus pending invites. */}
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No users to show.</p>
          ) : (
            rows.map((row) => {
              const isStaff = row.role === "admin" || row.role === "dev";
              const draft = row.userId ? day1Draft[row.userId] ?? row.day1 ?? "" : "";
              return (
                <div key={row.key} className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium">
                        {row.email}
                        {isStaff && (
                          <span className="rounded-full bg-[hsl(6,60%,55%)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[hsl(6,55%,42%)]">
                            {row.role}
                          </span>
                        )}
                        {row.inviteOnly && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                            invited
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.displayName ? `${row.displayName} · ` : ""}
                        <span className={row.accessLevel === "premium" ? "font-semibold text-[hsl(36,70%,40%)]" : ""}>
                          {row.accessLevel}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Premium</span>
                      <Switch
                        checked={row.allowlistActive || (isStaff && row.accessLevel === "premium")}
                        disabled={busyKey === row.key || isStaff}
                        onCheckedChange={(v) => void togglePremium(row, v)}
                        title={isStaff ? "Staff are premium by role" : "Grant or revoke premium"}
                      />
                      {row.inviteOnly && (
                        <Button variant="outline" size="sm" onClick={() => void removeInvite(row)} disabled={busyKey === row.key}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Day 1 editor — only for real, signed-up users. */}
                  {row.userId && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Day 1</span>
                      <Input
                        type="date"
                        value={draft}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDay1Draft((d) => ({ ...d, [row.userId as string]: e.target.value }))}
                        className="h-8 w-auto"
                      />
                      <Button size="sm" onClick={() => void proposeDay1(row)} disabled={busyKey === row.key}>
                        Propose change
                      </Button>
                      {row.pendingDay1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(42,95%,62%)]/20 px-2 py-1 text-xs font-bold text-[hsl(36,70%,35%)]">
                          <CalendarClock className="h-3 w-3" />
                          Awaiting user: {row.pendingDay1}
                          <button
                            type="button"
                            onClick={() => void cancelDay1(row)}
                            className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                            title="Cancel this proposal"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumAccessManager;
