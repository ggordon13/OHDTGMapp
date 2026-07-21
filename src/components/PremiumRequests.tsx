import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Inbox, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { canManageAccess, type PremiumRequest } from "@/lib/access";
import { toast } from "sonner";

const PremiumRequests = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [requests, setRequests] = useState<PremiumRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = useMemo(() => canManageAccess(profile?.role ?? undefined), [profile?.role]);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("premium_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setRequests((data ?? []) as PremiumRequest[]);
  }, []);

  useEffect(() => {
    if (canManage) void loadRequests();
  }, [canManage, loadRequests]);

  // Approving grants premium through the existing allowlist mechanism, so the
  // user is upgraded the same way a manually-added email would be.
  const approve = async (req: PremiumRequest) => {
    if (!user) return;
    setBusyId(req.id);

    const { error: grantError } = await supabase.from("premium_allowlist").upsert(
      { email: req.email.trim().toLowerCase(), access_level: "premium", is_active: true },
      { onConflict: "email" },
    );
    if (grantError) {
      setBusyId(null);
      toast.error("Couldn't grant premium access.");
      return;
    }

    const { error } = await supabase
      .from("premium_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", req.id);

    setBusyId(null);
    if (error) {
      toast.error("Granted access, but couldn't close the request.");
    } else {
      toast.success(`${req.email} is now premium 👑`);
    }
    await loadRequests();
  };

  const reject = async (req: PremiumRequest) => {
    if (!user) return;
    setBusyId(req.id);
    const { error } = await supabase
      .from("premium_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", req.id);
    setBusyId(null);
    if (error) toast.error("Couldn't update the request.");
    else toast.success(`Dismissed ${req.email}'s request.`);
    await loadRequests();
  };

  if (!canManage) return null;

  return (
    <Card className="border-[hsl(38,60%,90%)]/20 bg-card/80 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5 text-[hsl(42,95%,62%)]" />
          Premium requests
          {requests.length > 0 && (
            <span className="ml-1 rounded-full bg-[hsl(42,95%,62%)] px-2 py-0.5 text-xs font-bold text-[hsl(26,50%,18%)]">
              {requests.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            <p className="text-sm font-medium">No pending requests.</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{req.email}</p>
                <p className="text-sm text-muted-foreground">
                  Requested {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void approve(req)}
                  disabled={busyId === req.id}
                  className="bg-[hsl(84,45%,40%)] text-white hover:bg-[hsl(84,45%,34%)]"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reject(req)}
                  disabled={busyId === req.id}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default PremiumRequests;
