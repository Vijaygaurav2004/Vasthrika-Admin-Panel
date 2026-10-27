// Who can use what.
//
//   owner   — explicitly listed below. Sees money, the website admin, and can
//             manage staff. Can never be deactivated or locked out.
//   staff   — tagged role "staff" by the owner (Manage staff on the dashboard),
//             or on the original staff list. Stock/QR app only, no money.
//   removed — a deactivated staff login. Signed out on sight.
//   none    — any other account (e.g. a stranger who signed themselves up).
//             No access at all. Access is fail-closed: being "not staff" is
//             NOT enough to be the owner.
//
// The staff tag lives in Supabase `app_metadata`, which only the server (with
// the secret key) can write — a user can't promote themselves.

type RoleUser =
  | { email?: string | null; app_metadata?: Record<string, unknown> | null }
  | null
  | undefined;

export type Role = "owner" | "staff" | "removed" | "none";

// Override on Vercel with NEXT_PUBLIC_OWNER_EMAILS (comma-separated).
const FALLBACK_OWNERS = ["skssatya@gmail.com"];

// The original staff logins, from before staff could be managed in the app.
// Kept so they keep working without needing the tag.
// Override with NEXT_PUBLIC_STAFF_EMAILS.
const FALLBACK_STAFF = [
  "sai@satyakrupa.com",
  "arun@satyakrupa.com",
  "govardan@satyakrupa.com",
  "murthy@satyakrupa.com",
];

// Original logins whose access was removed. They stay removed until the owner
// reactivates them in Manage staff (which sets app_metadata.active = true).
// Override with NEXT_PUBLIC_REMOVED_EMAILS.
const FALLBACK_REMOVED = ["sai@satyakrupa.com", "murthy@satyakrupa.com"];

function emailList(raw: string | undefined, fallback: string[]): string[] {
  const source = raw ? raw.split(",") : fallback;
  return source.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const norm = (email?: string | null) => (email || "").trim().toLowerCase();

export function ownerEmails(): string[] {
  return emailList(process.env.NEXT_PUBLIC_OWNER_EMAILS, FALLBACK_OWNERS);
}

export function staffEmails(): string[] {
  return emailList(process.env.NEXT_PUBLIC_STAFF_EMAILS, FALLBACK_STAFF);
}

export function removedEmails(): string[] {
  return emailList(process.env.NEXT_PUBLIC_REMOVED_EMAILS, FALLBACK_REMOVED);
}

export function isOwnerEmail(email?: string | null): boolean {
  const e = norm(email);
  return !!e && ownerEmails().includes(e);
}

export function isStaffEmail(email?: string | null): boolean {
  const e = norm(email);
  return !!e && staffEmails().includes(e);
}

function meta(u: RoleUser): Record<string, unknown> {
  return (u?.app_metadata as Record<string, unknown>) || {};
}

/** Tagged as staff by the owner, or on the original staff list. */
export function isStaffUser(u: RoleUser): boolean {
  return meta(u).role === "staff" || isStaffEmail(u?.email);
}

/** Deactivated by the owner, or on the original removed list (until reactivated). */
export function isRemovedUser(u: RoleUser): boolean {
  const active = meta(u).active;
  if (active === false) return true;
  return removedEmails().includes(norm(u?.email)) && active !== true;
}

export function roleOf(u: RoleUser): Role {
  if (!norm(u?.email)) return "none";
  if (isOwnerEmail(u?.email)) return "owner"; // owner can never be locked out
  if (isRemovedUser(u)) return "removed";
  if (isStaffUser(u)) return "staff";
  return "none";
}

/** True only for the owner (may see money, website admin, manage staff). */
export function isAdminUser(u: RoleUser): boolean {
  return roleOf(u) === "owner";
}

/** Turn "sai@satyakrupa.com" into "Sai" for display. */
export function displayName(email?: string | null): string {
  if (!email) return "Someone";
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Someone";
}
