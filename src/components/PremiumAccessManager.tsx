import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { canManageAccess, normalizeAccessLevel, type PremiumAllowlistEntry } from "@/lib/access";

const PremiumAccessManager = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [entries, setEntries] = useState<PremiumAllowlistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<"free" | "premium">("premium");
  const [loading, setLoading] = useState(false);

  const canManage = useMemo(() => canManageAccess(profile?.role ?? undefined), [profile?.role]);

  const loadEntries = async () => {
    const { data } = await supabase.from("premium_allowlist").select("*").order("email", { ascending: true });
    setEntries((data ?? []) as PremiumAllowlistEntry[]);
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const handleAdd = async () => {
    if (!user || !email.trim()) return;
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.from("premium_allowlist").upsert(
      { email: normalizedEmail, access_level: accessLevel, is_active: true },
      { onConflict: "email" },
    );
    setLoading(false);
    if (!error) {
      setEmail("");
      setAccessLevel("premium");
      await loadEntries();
    }
  };

  const handleDelete = async (entry: PremiumAllowlistEntry) => {
    setLoading(true);
    const { error } = await supabase.from("premium_allowlist").delete().eq("id", entry.id);
    setLoading(false);
    if (!error) await loadEntries();
  };

  const toggleActive = async (entry: PremiumAllowlistEntry) => {
    setLoading(true);
    const { error } = await supabase.from("premium_allowlist").update({ is_active: !entry.is_active }).eq("id", entry.id);
    setLoading(false);
    if (!error) await loadEntries();
  };

  if (!canManage) return null;

  return (
    <Card className="border-[hsl(38,60%,90%)]/20 bg-card/80 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-[hsl(42,95%,62%)]" />
          Premium access manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
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

        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id ?? entry.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 p-3">
              <div>
                <p className="font-medium">{entry.email}</p>
                <p className="text-sm text-muted-foreground">
                  {normalizeAccessLevel(entry.access_level)} · {entry.is_active ? "active" : "inactive"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Active</span>
                  <Switch checked={Boolean(entry.is_active)} onCheckedChange={() => void toggleActive(entry)} />
                </div>
                <Button variant="outline" size="sm" onClick={() => void handleDelete(entry)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumAccessManager;
