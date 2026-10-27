// context/auth-context.tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthChangeEvent, Session, User, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { roleOf, Role } from "@/lib/role";

/** Thrown by signIn when the login was deactivated by the owner. */
export const ACCESS_REMOVED = "ACCESS_REMOVED";
/** Thrown by signIn when the login isn't the owner or a staff member. */
export const NO_ACCESS = "NO_ACCESS";

type AuthContextType = {
  user: User | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RECHECK_MS = 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // The login currently accepted on this device, and when each staff login was
  // last re-checked with the server.
  const currentId = useRef<string | null>(null);
  const lastCheck = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Sign a specific login out of THIS device — but only if it's still the one
    // signed in, so a late answer can never sign out someone who just logged in.
    // Deferred: calling auth methods inside onAuthStateChange can deadlock.
    const signOutIfStill = (targetId: string) => {
      setTimeout(async () => {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (data.session?.user.id === targetId) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
      }, 0);
    };

    const drop = (targetId: string) => {
      if (currentId.current === targetId) {
        currentId.current = null;
        setUser(null);
      }
      signOutIfStill(targetId);
    };

    // Has the owner deactivated this staff login since the session started?
    const verifyStillActive = (u: User, token: string) => {
      const last = lastCheck.current.get(u.id) || 0;
      if (Date.now() - last < RECHECK_MS) return;
      lastCheck.current.set(u.id, Date.now());
      fetch("/api/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
        .then(async (r) => {
          if (r.status === 401 && supabase) {
            // Token not accepted. A blocked login can't refresh either; an
            // expired-but-fine one just refreshes and carries on.
            const { error } = await supabase.auth.refreshSession();
            return error && !isAuthRetryableFetchError(error) ? { active: false } : null;
          }
          return r.ok ? r.json() : null;
        })
        .then((d) => {
          if (d && d.active === false) drop(u.id);
        })
        .catch(() => {});
    };

    // Only the owner and active staff get in. Anyone else (deactivated staff, or
    // an account nobody added) is signed out, so every screen falls back to /login.
    const accept = (session: Session | null, event?: AuthChangeEvent) => {
      const u = session?.user ?? null;
      if (!u) {
        currentId.current = null;
        setUser(null);
        return;
      }
      const role = roleOf(u);
      if (role !== "owner" && role !== "staff") {
        drop(u.id);
        return;
      }
      currentId.current = u.id;
      setUser(u);

      // Re-check staff with the server when the app opens, on sign-in, and each
      // time it comes back to the foreground (Supabase fires SIGNED_IN then) or
      // refreshes the token — at most once a minute.
      if (
        role === "staff" &&
        session?.access_token &&
        (event === undefined || event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
      ) {
        verifyStillActive(u, session.access_token);
      }
    };

    // Check active sessions and sets the user
    supabase?.auth.getSession().then(({ data: { session } }) => {
      accept(session);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
      accept(session, event);
      setLoading(false);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // Supabase refuses blocked (deactivated) logins itself.
      if (/banned/i.test(error.message)) throw new Error(ACCESS_REMOVED);
      throw new Error(error.message);
    }
    const role = roleOf(data.user);
    if (role === "owner" || role === "staff") return;
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    throw new Error(role === "removed" ? ACCESS_REMOVED : NO_ACCESS);
  };

  const signOut = async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const logout = signOut;

  return (
    <AuthContext.Provider value={{ user, role: roleOf(user), loading, signIn, signOut, logout }}>
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
