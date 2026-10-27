import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, userFromRequest, bearerToken, isBanned } from "@/lib/supabase/admin";
import { roleOf } from "@/lib/role";

// GET /api/me — is this login still allowed in? Called when the app opens so a
// staff member deactivated while logged in is signed out right away, instead
// of whenever their session next refreshes.
//   { active: true | false }   — false means sign out now
//   { active: null }           — can't tell (key not set up); app carries on

export const dynamic = "force-dynamic";

// Read the user id from a JWT without trusting it. Only used to look up the
// ban status of a token that Supabase itself refused — it reveals nothing more
// than "is this id blocked".
function unverifiedSub(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ active: null });

  const user = await userFromRequest(request);
  let id = user?.id ?? null;
  if (!id) {
    // Supabase may refuse a blocked user's token outright — check if that's why.
    const token = bearerToken(request);
    id = token ? unverifiedSub(token) : null;
    if (!id) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    const { data } = await admin.auth.admin.getUserById(id);
    if (data?.user && isBanned(data.user)) return NextResponse.json({ active: false });
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) return NextResponse.json({ active: null });

  const role = roleOf(data.user);
  const active = !isBanned(data.user) && (role === "owner" || role === "staff");
  return NextResponse.json({ active, role });
}
