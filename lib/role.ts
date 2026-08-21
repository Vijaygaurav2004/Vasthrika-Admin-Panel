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

export function staffEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_STAFF_EMAILS;
  const source = raw ? raw.split(",") : FALLBACK_STAFF;
  return source.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isStaffEmail(email?: string | null): boolean {
  if (!email) return false;
  return staffEmails().includes(email.toLowerCase());
}

/** Admin = any logged-in user who is NOT in the staff list (i.e. the owner). */
export function isAdminEmail(email?: string | null): boolean {
  return !!email && !isStaffEmail(email);
}

/** Turn "sai@satyakrupa.com" into "Sai" for display. */
export function displayName(email?: string | null): string {
  if (!email) return "Someone";
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Someone";
}
