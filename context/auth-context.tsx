// context/auth-context.tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const checked = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const kick = () => {
      setUser(null);
      // Deferred: calling auth methods inside onAuthStateChange can deadlock.
      setTimeout(() => {
        supabase?.auth.signOut().catch(() => {});
      }, 0);
    };

    // Only the owner and active staff get in. Anyone else (deactivated staff, or
    // an account nobody added) is signed out, so every screen falls back to /login.
    const accept = (session: Session | null) => {
      const u = session?.user ?? null;
      if (!u) {
        setUser(null);
        return;
      }
      const role = roleOf(u);
      if (role !== "owner" && role !== "staff") {
        kick();
        return;
      }
      setUser(u);

      // A staff member may have been deactivated after this session started —
      // ask the server once per app open, and sign them out if so.
      if (role === "staff" && session?.access_token && !checked.current.has(u.id)) {
        checked.current.add(u.id);
        fetch("/api/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.active === false) kick();
          })
          .catch(() => {});
      }
    };

    // Check active sessions and sets the user
    supabase?.auth.getSession().then(({ data: { session } }) => {
      accept(session);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      accept(session);
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
    await supabase.auth.signOut().catch(() => {});
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
