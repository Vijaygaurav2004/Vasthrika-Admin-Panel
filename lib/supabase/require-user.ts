import "server-only";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { bearerToken, isBanned, userFromRequest } from "@/lib/supabase/admin";
import { roleOf } from "@/lib/role";

// Gate for every /api route: the caller must send `Authorization: Bearer
// <access token>` (see lib/api.ts) and be the owner or an active staff login.
//
// `db` talks to Supabase AS that user (anon key + their token), so the
// database's own rules (supabase/LOCK_DOWN_ACCESS.sql) apply on top of this
// check. It doesn't need the secret key, so it works before that is set up.

export type AppRole = "owner" | "staff";

export type AppUser = { user: User; role: AppRole; db: SupabaseClient };

export async function requireAppUser(
  request: Request,
  allowed: AppRole[] = ["owner", "staff"]
): Promise<AppUser | { response: NextResponse }> {
  const user = await userFromRequest(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Please log in again." }, { status: 401 }) };
  }
  const role = roleOf(user);
  if (isBanned(user) || (role !== "owner" && role !== "staff") || !allowed.includes(role)) {
    return { response: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearerToken(request)}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return { user, role, db };
}
