"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { StaffMember } from "@/types/staff";

// Owner-only: add staff logins, deactivate / reactivate them, reset passwords.
// Everything goes through /api/staff, which re-checks on the server that the
// caller really is the owner.

async function staffApi(method: "GET" | "POST" | "PATCH", body?: object) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/staff", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function ManageStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { res, data } = await staffApi("GET");
      if (res.status === 503 && data.error === "setup") {
        setSetupNeeded(true);
        return;
      }
      setSetupNeeded(false);
      if (!res.ok) throw new Error(data.error || "Couldn't load staff");
      setStaff(data.staff || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addStaff = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email || form.password.length < 6) {
      toast({
        title: "Fill in the details",
        description: "Email and a password of at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      let { res, data } = await staffApi("POST", { ...form, email });
      if (res.status === 409 && data.code === "exists_not_staff") {
        const ok = window.confirm(
          `${email} already has a login that isn't set up as staff (maybe made earlier in Supabase).\n\n` +
            `Replace it with a new staff login using the password you typed? The old login will stop working.`
        );
        if (!ok) return;
        ({ res, data } = await staffApi("POST", { ...form, email, replace: true }));
      }
      if (!res.ok) throw new Error(data.error || "Couldn't add staff");
      toast({
        title: "Staff added",
        description: `${data.staff.name} can now log in with ${email} and the password you set.`,
      });
      setForm({ name: "", email: "", password: "" });
      setShowAdd(false);
      setShowPw(false);
      await load();
    } catch (e) {
      toast({ title: "Couldn't add staff", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const setActive = async (m: StaffMember, active: boolean) => {
    const msg = active
      ? `Activate ${m.name} (${m.email})? They'll be able to log in again.`
      : `Deactivate ${m.name} (${m.email})? They'll be logged out and can't log in. Their past added/sold history is kept.`;
    if (!window.confirm(msg)) return;
    setBusyId(m.id);
    try {
      const { res, data } = await staffApi("PATCH", { id: m.id, active });
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast({ title: active ? "Activated" : "Deactivated", description: m.name });
      await load();
    } catch (e) {
      toast({ title: "Couldn't update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (m: StaffMember) => {
    const pw = window.prompt(`New password for ${m.name} (${m.email}) — at least 6 characters:`);
    if (pw == null) return;
    if (pw.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setBusyId(m.id);
    try {
      const { res, data } = await staffApi("PATCH", { id: m.id, password: pw });
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast({ title: "Password changed", description: `Give ${m.name} the new password.` });
    } catch (e) {
      toast({ title: "Couldn't change password", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = staff.filter((s) => s.active).length;

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Manage staff</h2>
          {!setupNeeded && !loading && (
            <p className="text-xs text-gray-500">
              {activeCount} active · {staff.length - activeCount} deactivated
            </p>
          )}
        </div>
        {!setupNeeded && (
          <Button size="sm" variant={showAdd ? "outline" : "default"} onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add staff"}
          </Button>
        )}
      </div>

      {setupNeeded ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">One-time setup needed</p>
          <p className="mt-1">
            To add or deactivate staff, the server needs your Supabase secret key:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Supabase → Project Settings → API Keys → copy the <b>secret</b> (service_role) key.</li>
            <li>
              Vercel → vasthrika-admin-panel → Settings → Environment Variables → add{" "}
              <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> for Production.
            </li>
            <li>Redeploy, then refresh this page.</li>
          </ol>
        </div>
      ) : (
        <>
          {showAdd && (
            <div className="mb-4 rounded-md border bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="staff-name">Name</Label>
                  <Input
                    id="staff-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ravi"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-email">Login email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="ravi@satyakrupa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="staff-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="min 6 characters"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowPw((s) => !s)}>
                      {showPw ? "Hide" : "Show"}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                They can log in straight away with this email and password. Staff never see prices or the website admin.
              </p>
              <Button className="mt-3" onClick={addStaff} disabled={adding}>
                {adding ? "Creating…" : "Create staff login"}
              </Button>
            </div>
          )}

          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading staff…</p>
          ) : loadError ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {loadError}{" "}
              <button className="underline" onClick={load}>
                Try again
              </button>
            </div>
          ) : staff.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No staff yet — tap “+ Add staff”.</p>
          ) : (
            <ul className="divide-y">
              {staff.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      m.active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${m.active ? "" : "text-gray-400"}`}>
                      {m.name}{" "}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {m.active ? "Active" : "Deactivated"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {m.email} · last login{" "}
                      {m.last_sign_in_at
                        ? formatDistanceToNow(new Date(m.last_sign_in_at), { addSuffix: true })
                        : "never"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {m.active && (
                      <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => resetPassword(m)}>
                        Reset password
                      </Button>
                    )}
                    {m.active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={busyId === m.id}
                        onClick={() => setActive(m, false)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busyId === m.id} onClick={() => setActive(m, true)}>
                        Activate
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
