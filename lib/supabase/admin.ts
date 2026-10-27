import "server-only";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { roleOf } from "@/lib/role";

// Supabase client with the SECRET key — can create logins and block them.
// Server-only: importing this from a client component fails the build, so the
// key can never end up in the browser.
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** The logged-in user behind a request's access token, or null. */
export async function userFromRequest(request: Request): Promise<User | null> {
  const token = bearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** Resolves to the owner's user, or a status code to reject the request with. */
export async function requireOwner(request: Request): Promise<{ user: User } | { status: 401 | 403 }> {
  const user = await userFromRequest(request);
  if (!user) return { status: 401 };
  if (roleOf(user) !== "owner") return { status: 403 };
  return { user };
}

/** Blocked in Supabase? (`banned_until` is sent by the server but missing from this SDK's User type.) */
export function isBanned(u: User | null | undefined): boolean {
  const until = (u as { banned_until?: string | null } | null | undefined)?.banned_until;
  return !!until && new Date(until).getTime() > Date.now();
}
