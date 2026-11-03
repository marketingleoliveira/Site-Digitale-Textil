import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { User, Session } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  reconnecting: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  role: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchRoles = useCallback(async (userId: string): Promise<{ admin: boolean; editor: boolean; primary: string | null }> => {
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching roles:", error);
        return { admin: false, editor: false, primary: null };
      }

      const userRoles = roles?.map((r) => String(r.role)) || [];
      const admin = userRoles.some(role => role === "admin" || role === "desenvolvedor");
      const editor = userRoles.some(role => 
        role === "editor" || role === "redator" || role === "vendedor" || role === "sdr"
      ) || admin;
      // Pick highest-priority role for menu logic
      const priority = ["desenvolvedor", "admin", "editor", "redator", "vendedor", "sdr", "user"];
      const primary = priority.find(p => userRoles.includes(p)) || userRoles[0] || null;
      return { admin, editor, primary };
    } catch (error) {
      console.error("Error fetching roles:", error);
      return { admin: false, editor: false, primary: null };
    }
  }, []);

  const stopRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const startRefreshInterval = useCallback(() => {
    stopRefreshInterval();
    refreshIntervalRef.current = setInterval(async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) await supabase.auth.refreshSession();
      } catch (e) {
        console.error("Token refresh error:", e);
      }
    }, TOKEN_REFRESH_INTERVAL);
  }, [stopRefreshInterval]);

  const handleSession = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    currentUserIdRef.current = newSession?.user?.id ?? null;

    if (newSession?.user) {
      const { admin, editor, primary } = await fetchRoles(newSession.user.id);
      setIsAdmin(admin);
      setIsEditor(editor);
      setRole(primary);
      startRefreshInterval();
    } else {
      setIsAdmin(false);
      setIsEditor(false);
      setRole(null);
      stopRefreshInterval();
    }
  }, [fetchRoles, startRefreshInterval, stopRefreshInterval]);

  useEffect(() => {
    let isMounted = true;

    // 1. Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        console.log("Auth event:", event);

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setIsEditor(false);
          setRole(null);
          currentUserIdRef.current = null;
          stopRefreshInterval();
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (newSession?.user) {
            // Use setTimeout to avoid Supabase deadlock on rapid events
            setTimeout(async () => {
              if (!isMounted) return;
              await handleSession(newSession);
              setLoading(false);
            }, 0);
          } else {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setIsEditor(false);
            setRole(null);
            currentUserIdRef.current = null;
            setLoading(false);
          }
        }
      }
    );

    // 2. Then get initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      // If no INITIAL_SESSION event fired yet, handle it manually
      if (initialSession?.user) {
        await handleSession(initialSession);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    // Visibility change handler
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || !isMounted) return;
      if (!currentUserIdRef.current) return;

      try {
        setReconnecting(true);
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (!isMounted) return;

        if (refreshed) {
          await handleSession(refreshed);
        } else {
          // Session expired
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setIsEditor(false);
          setRole(null);
          currentUserIdRef.current = null;
          stopRefreshInterval();
          toast.error("Sessão expirada", {
            description: "Por favor, faça login novamente.",
            duration: 4000
          });
        }
      } catch (error) {
        console.error("Visibility change error:", error);
      } finally {
        if (isMounted) setReconnecting(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopRefreshInterval();
      clearTimeout(safetyTimeout);
    };
  }, [handleSession, stopRefreshInterval]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // onAuthStateChange will handle the rest
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    stopRefreshInterval();
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT will handle state cleanup
    toast.info("Você saiu da sua conta");
  }, [stopRefreshInterval]);

  return (
    <AuthContext.Provider value={{ 
      user, session, loading, reconnecting, 
      isAdmin, isEditor, role, signIn, signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
