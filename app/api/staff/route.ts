import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminClient, requireOwner, isBanned } from "@/lib/supabase/admin";
import { roleOf, isOwnerEmail, displayName } from "@/lib/role";
import type { StaffMember } from "@/types/staff";

// Owner-only staff management. Every request must carry the owner's access
// token (Authorization: Bearer …) — checked server-side, not just hidden in UI.

export const dynamic = "force-dynamic";

const BAN_FOREVER = "876000h"; // ~100 years
const MIN_PASSWORD = 6; // Supabase's minimum
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SETUP_MSG =
  "Staff management needs the Supabase secret key on the server (SUPABASE_SERVICE_ROLE_KEY).";

// Names live in app_metadata (only the server can write it). user_metadata is
// editable by the user themselves, so it's only a legacy fallback — and only if
// it's a plain string, so a crafted value can't break the list.
function staffName(u: User): string {
  for (const raw of [u.app_metadata?.name, u.user_metadata?.name]) {
    if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 60);
  }
  return displayName(u.email);
}

function toStaff(u: User): StaffMember {
  return {
    id: u.id,
    email: u.email || "",
    name: staffName(u),
    active: roleOf(u) === "staff" && !isBanned(u),
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
  };
}

async function allUsers(admin: SupabaseClient): Promise<User[]> {
  const perPage = 1000;
  const users: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
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

const fail = (e: unknown, status = 500) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });

// GET /api/staff — every staff login (active and deactivated)
export async function GET(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin } = g;

  try {
    const users = await allUsers(admin);

    // "Deactivated" must mean "can't log in" at Supabase too. Logins removed
    // before this feature existed (e.g. sai@, murthy@) were only blocked inside
    // the app — block them in Supabase now so the list tells the truth.
    for (const u of users) {
      if (roleOf(u) === "removed" && !isBanned(u)) {
        const { data } = await admin.auth.admin.updateUserById(u.id, {
          ban_duration: BAN_FOREVER,
          app_metadata: { ...(u.app_metadata || {}), role: "staff", active: false },
        });
        if (data?.user) Object.assign(u, data.user);
      }
    }

    const staff = users
      .filter((u) => {
        const r = roleOf(u);
        return r === "staff" || r === "removed";
      })
      .map(toStaff)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

    return NextResponse.json({ staff });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/staff  { name, email, password, replace? } — add a new staff login
export async function POST(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin } = g;

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim().slice(0, 60) || displayName(email);
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

  try {
    const create = () =>
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // no confirmation email — they can log in right away
        app_metadata: { role: "staff", active: true, name },
      });

    let { data, error } = await create();

    if (error && /already|exists|registered/i.test(error.message)) {
      const existing = (await allUsers(admin)).find((u) => (u.email || "").toLowerCase() === email);
      const role = existing ? roleOf(existing) : "none";

      if (existing && (role === "staff" || role === "removed")) {
        return NextResponse.json(
          {
            error:
              role === "staff"
                ? `${email} is already an active staff login.`
                : `${email} is a deactivated staff login — tap Activate on it in the list instead.`,
          },
          { status: 409 }
        );
      }

      // A login exists for this email but it isn't staff (e.g. made by hand in
      // Supabase, or a self sign-up). Don't promote it in place — whoever made it
      // could keep an old session. Only with the owner's OK: delete it and
      // create a fresh staff login. Stock history stores emails, not user ids,
      // so nothing is lost.
      if (existing && role === "none") {
        if (body.replace !== true) {
          return NextResponse.json(
            {
              error: `${email} already has a login that isn't set up as staff.`,
              code: "exists_not_staff",
            },
            { status: 409 }
          );
        }
        const { error: delErr } = await admin.auth.admin.deleteUser(existing.id);
        if (delErr) return fail(delErr);
        ({ data, error } = await create());
      }
    }

    if (error || !data.user) return fail(error || "Could not create the login.");
    return NextResponse.json({ staff: toStaff(data.user) });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/staff  { id, active?, password?, name? } — activate / deactivate /
// reset password / rename a staff login
export async function PATCH(request: NextRequest) {
  const g = await guard(request);
  if (g.res) return g.res;
  const { admin, owner } = g;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!UUID.test(id)) return NextResponse.json({ error: "Staff login not found" }, { status: 404 });
  if (id === owner.id) return NextResponse.json({ error: "You can't change your own login here." }, { status: 400 });

  try {
    const { data: found, error: findErr } = await admin.auth.admin.getUserById(id);
    if (findErr || !found.user) return NextResponse.json({ error: "Staff login not found" }, { status: 404 });
    const target = found.user;

    // Only staff logins (active or deactivated) can be managed — never the owner
    // or some unrelated account.
    const targetRole = roleOf(target);
    if (targetRole !== "staff" && targetRole !== "removed") {
      return NextResponse.json({ error: "That login isn't a staff member." }, { status: 403 });
    }

    const appMeta: Record<string, unknown> = { ...(target.app_metadata || {}) };
    const update: { ban_duration?: string; app_metadata?: Record<string, unknown>; password?: string } = {};

    if (typeof body.active === "boolean") {
      // Block/unblock at the Supabase level (stops sign-in and token refresh) AND
      // record it in app_metadata so the app signs them out right away.
      update.ban_duration = body.active ? "none" : BAN_FOREVER;
      appMeta.role = "staff";
      appMeta.active = body.active;
      update.app_metadata = appMeta;
    }
    if (body.password != null) {
      const pw = String(body.password);
      if (pw.length < MIN_PASSWORD) {
        return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
      }
      update.password = pw;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      appMeta.name = body.name.trim().slice(0, 60);
      update.app_metadata = appMeta;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    const { data, error } = await admin.auth.admin.updateUserById(id, update);
    if (error || !data.user) return fail(error || "Update failed");
    return NextResponse.json({ staff: toStaff(data.user) });
  } catch (e) {
    return fail(e);
  }
}
