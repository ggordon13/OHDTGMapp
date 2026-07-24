import { useCallback, useEffect, useMemo, useState } from "react";
import { Swords, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/useProfile";
import { canManageAccess } from "@/lib/access";
import { toast } from "sonner";

interface AdminChallengeRow {
  id: string;
  mode: string;
  status: string;
  start_date: string;
  leader_username: string | null;
  member_count: number;
}

/** Admin view of active/pending challenges, with the power to change Day 1. */
const AdminChallenges = () => {
  const { profile } = useProfile();
  const [rows, setRows] = useState<AdminChallengeRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = useMemo(() => canManageAccess(profile?.role ?? undefined), [profile?.role]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_list_challenges");
    setRows((data ?? []) as AdminChallengeRow[]);
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const save = async (row: AdminChallengeRow) => {
    const next = drafts[row.id] ?? row.start_date;
    if (next === row.start_date) {
      toast.info("Pick a different Day 1 to change it.");
      return;
    }
    setBusyId(row.id);
    const { error } = await supabase.rpc("admin_set_challenge_start", { p_challenge: row.id, p_start_date: next });
    setBusyId(null);
    if (error) toast.error("Couldn't change Day 1.");
    else {
      toast.success("Day 1 updated.");
      await load();
    }
  };

  if (!canManage) return null;

  return (
    <Card className="border-[hsl(38,60%,90%)]/20 bg-card/80 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="h-5 w-5 text-[hsl(222,55%,55%)]" />
          Active challenges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            <p className="text-sm font-medium">No active challenges.</p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.leader_username ?? "(no nickname)"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {row.mode} · {row.status} · {row.member_count} in
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={drafts[row.id] ?? row.start_date}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  className="h-9 w-auto"
                />
                <Button size="sm" onClick={() => void save(row)} disabled={busyId === row.id}>
                  Set Day 1
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AdminChallenges;
