import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getAdminClient, requireOwner, isBanned } from "@/lib/supabase/admin";
import { roleOf, isOwnerEmail, displayName } from "@/lib/role";
import type { StaffMember } from "@/types/staff";

// Owner-only staff management. Every request must carry the owner's access
// token (Authorization: Bearer …) — checked server-side, not just hidden in UI.

export const dynamic = "force-dynamic";

const BAN_FOREVER = "876000h"; // ~100 years
const MIN_PASSWORD = 6; // Supabase's minimum

const SETUP_MSG =
  "Staff management needs the Supabase secret key on the server (SUPABASE_SERVICE_ROLE_KEY).";

function toStaff(u: User): StaffMember {
  const name = (u.user_metadata?.name as string | undefined)?.trim();
  return {
    id: u.id,
    email: u.email || "",
    name: name || displayName(u.email),
    active: roleOf(u) === "staff" && !isBanned(u),
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
  };
}

async function guard(request: NextRequest) {
  const auth = await requireOwner(request);
  if ("status" in auth) {
    return {
      res: NextResponse.json(
        { error: auth.status === 401 ? "Please log in again." : "Only the owner can manage staff." },
        { status: auth.status }
      ),
    };
  }
  const admin = getAdminClient();
  if (!admin) return { res: NextResponse.json({ error: "setup", message: SETUP_MSG }, { status: 503 }) };
  return { admin, owner: auth.user };
}

// GET /api/staff — every staff login (active and deactivated)
export async function GET(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin } = g;

  const perPage = 1000;
  const users: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const staff = users
    .filter((u) => {
      const r = roleOf(u);
      return r === "staff" || r === "removed";
    })
    .map(toStaff)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return NextResponse.json({ staff });
}

// POST /api/staff  { name, email, password } — add a new staff login
export async function POST(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin } = g;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email, e.g. name@satyakrupa.com" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }
  if (isOwnerEmail(email)) {
    return NextResponse.json({ error: "That's the owner's email — it can't be a staff login." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email needed — they can log in right away
    user_metadata: { name: name || displayName(email) },
    app_metadata: { role: "staff", active: true },
  });

  if (error || !data.user) {
    const exists = /already|exists|registered/i.test(error?.message || "");
    return NextResponse.json(
      {
        error: exists
          ? `A login for ${email} already exists. If it's a deactivated staff member, activate them in the list instead.`
          : error?.message || "Could not create the login.",
      },
      { status: exists ? 409 : 500 }
    );
  }

  return NextResponse.json({ staff: toStaff(data.user) });
}

// PATCH /api/staff  { id, active?, password?, name? } — activate / deactivate /
// reset password / rename a staff login
export async function PATCH(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin, owner } = g;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
  if (id === owner.id) return NextResponse.json({ error: "You can't change your own login here." }, { status: 400 });

  const { data: found, error: findErr } = await admin.auth.admin.getUserById(id);
  if (findErr || !found.user) return NextResponse.json({ error: "Staff login not found" }, { status: 404 });
  const target = found.user;

  // Only staff logins (active or deactivated) can be managed — never the owner
  // or some unrelated account.
  const targetRole = roleOf(target);
  if (targetRole !== "staff" && targetRole !== "removed") {
    return NextResponse.json({ error: "That login isn't a staff member." }, { status: 403 });
  }

  const update: {
    ban_duration?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    password?: string;
  } = {};

  if (typeof body.active === "boolean") {
    // Block/unblock at the Supabase level (stops sign-in and token refresh) AND
    // record it in app_metadata so the app signs them out immediately.
    update.ban_duration = body.active ? "none" : BAN_FOREVER;
    update.app_metadata = { ...(target.app_metadata || {}), role: "staff", active: body.active };
  }
  if (body.password != null) {
    const pw = String(body.password);
    if (pw.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    update.password = pw;
  }
  if (typeof body.name === "string" && body.name.trim()) {
    update.user_metadata = { ...(target.user_metadata || {}), name: body.name.trim() };
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.updateUserById(id, update);
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ staff: toStaff(data.user) });
}
