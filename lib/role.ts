// Staff logins can use ONLY the stock/QR app (/staff) and never see money or
// the website admin. Everyone else who logs in is treated as the owner/admin.
//
// The staff list is baked in below and can also be overridden on Vercel with
// NEXT_PUBLIC_STAFF_EMAILS (comma-separated).
const FALLBACK_STAFF = [
  "sai@satyakrupa.com",
  "arun@satyakrupa.com",
  "govardan@satyakrupa.com",
  "murthy@satyakrupa.com",
];

// Logins whose access has been removed: signed out on sight and refused at
// sign-in. Deliberately a separate list — taking someone OFF the staff list
// would make them an admin (admin = "not staff"). They stay on the staff list
// too, as a second guard. Their past added/sold history is kept.
// Can be overridden on Vercel with NEXT_PUBLIC_REMOVED_EMAILS.
const FALLBACK_REMOVED = [
  "sai@satyakrupa.com",
  "murthy@satyakrupa.com",
];

function emailList(raw: string | undefined, fallback: string[]): string[] {
  const source = raw ? raw.split(",") : fallback;
  return source.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function staffEmails(): string[] {
  return emailList(process.env.NEXT_PUBLIC_STAFF_EMAILS, FALLBACK_STAFF);
}

export function removedEmails(): string[] {
  return emailList(process.env.NEXT_PUBLIC_REMOVED_EMAILS, FALLBACK_REMOVED);
}

export function isStaffEmail(email?: string | null): boolean {
  if (!email) return false;
  return staffEmails().includes(email.toLowerCase());
}

/** True for a login whose access has been taken away. */
export function isRemovedEmail(email?: string | null): boolean {
  if (!email) return false;
  return removedEmails().includes(email.trim().toLowerCase());
}

/** Admin = a logged-in user who is NOT staff and NOT removed (i.e. the owner). */
export function isAdminEmail(email?: string | null): boolean {
  return !!email && !isStaffEmail(email) && !isRemovedEmail(email);
}

/** Turn "sai@satyakrupa.com" into "Sai" for display. */
export function displayName(email?: string | null): string {
  if (!email) return "Someone";
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Someone";
}
