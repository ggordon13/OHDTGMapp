import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only propagate a session when the signed-in USER actually changes. Supabase
    // refreshes its token on tab focus/visibility and fires onAuthStateChange with
    // a brand-new session object for the same user; blindly setting it would change
    // `user`'s identity and cascade into refetches/re-renders that wipe unsaved form
    // input. The client keeps the refreshed token internally, so RPCs stay authed.
    let currentUserId: string | null | undefined;
    const apply = (session: Session | null) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setSession(session);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    supabase.auth.getSession().then(({ data: { session } }) => apply(session));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
