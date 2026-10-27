import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, userFromRequest, isBanned } from "@/lib/supabase/admin";
import { roleOf } from "@/lib/role";

// GET /api/me — is this login still allowed in? Called when the app opens or
// comes back to the foreground, so a staff member deactivated while logged in
// is signed out right away instead of when their session next refreshes.
//   { active: true | false }   — false means sign out now
//   { active: null }           — can't tell (key not set up); app carries on
//   401                        — token not accepted; the app then tries a
//                                session refresh, which Supabase refuses for a
//                                blocked login

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ active: null });

  try {
    const { data, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !data.user) return NextResponse.json({ active: null });
    const role = roleOf(data.user);
    const active = !isBanned(data.user) && (role === "owner" || role === "staff");
    return NextResponse.json({ active, role });
  } catch {
    return NextResponse.json({ active: null });
  }
}
