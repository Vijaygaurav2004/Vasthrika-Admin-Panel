import { supabase } from "@/lib/supabase/client";

/**
 * fetch() for our own /api routes. Adds the logged-in user's access token —
 * every route rejects calls without one (lib/supabase/require-user.ts).
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (token?: string) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await send(session?.access_token);
  if (res.status !== 401) return res;

  // The token can expire between reading it and the server checking it (e.g.
  // a phone that slept mid Bulk Add). A 401 means nothing was done, so refresh
  // once and retry.
  const { data } = await supabase.auth.refreshSession();
  if (!data.session) return res;
  return send(data.session.access_token);
}
