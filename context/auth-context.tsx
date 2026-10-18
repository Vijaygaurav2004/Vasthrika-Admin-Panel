// context/auth-context.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { isRemovedEmail } from "@/lib/role";

/** Thrown by signIn when the login's access has been removed. */
export const ACCESS_REMOVED = "ACCESS_REMOVED";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // A removed login (e.g. a phone that was already signed in) is signed out
    // the moment the app sees it, so every screen falls back to /login.
    const accept = (session: Session | null) => {
      const u = session?.user ?? null;
      if (u && isRemovedEmail(u.email)) {
        setUser(null);
        // Deferred: calling auth methods inside onAuthStateChange can deadlock.
        setTimeout(() => {
          supabase?.auth.signOut().catch(() => {});
        }, 0);
        return;
      }
      setUser(u);
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

    // Refuse removed logins before a session is even created.
    if (isRemovedEmail(email)) throw new Error(ACCESS_REMOVED);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    // Belt and braces (e.g. email typed with different spacing/case).
    if (isRemovedEmail(data.user?.email)) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(ACCESS_REMOVED);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const logout = signOut;

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, logout }}>
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