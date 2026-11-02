"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/role";

const NAV = [
  { href: "/staff/dashboard", label: "Dashboard" },
  { href: "/staff/inventory", label: "Inventory" },
  { href: "/staff/bulk-add", label: "Bulk Add" },
  { href: "/staff/collections", label: "Collections", adminOnly: true },
  { href: "/staff/sell", label: "Sell (Scan)" },
  { href: "/staff/firms", label: "Firms" },
  { href: "/staff/labels", label: "QR Labels" },
];

// Desktop/large iPad: fixed sidebar. Phones/small iPad: a top bar with a ☰
// button that slides the same menu in from the left.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) router.push("/login");
  }, [mounted, user, router]);

  // Close the mobile menu after navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While the menu is open: no background scrolling, Escape closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!mounted || !user) return null;

  const admin = isAdminUser(user);
  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };
  const items = NAV.filter((n) => admin || !n.adminOnly);

  const navList = (
    <ul>
      {items.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            className={`block px-4 py-3 lg:py-2 ${
              pathname?.startsWith(n.href) ? "bg-primary text-white" : "hover:bg-gray-100"
            }`}
          >
            {n.label}
          </Link>
        </li>
      ))}
      {admin && (
        <li className="mt-4 border-t pt-4">
          <Link href="/products" className="block px-4 py-3 text-sm text-gray-500 hover:bg-gray-100 lg:py-2">
            Website Admin →
          </Link>
        </li>
      )}
    </ul>
  );

  return (
    <div className="min-h-screen bg-gray-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-white shadow-md lg:block">
        <div className="p-6">
          <h1 className="text-xl font-bold">Satyakrupa Stock</h1>
        </div>
        <nav className="mt-6">{navList}</nav>
      </aside>

      {/* Mobile slide-in menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-lg font-bold">Satyakrupa Stock</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="-mr-2 rounded-md p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">{navList}</nav>
            <div className="border-t p-4">
              <p className="truncate text-xs text-gray-500">{user.email}</p>
              <Button variant="outline" className="mt-2 w-full" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-30 bg-white shadow lg:static"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="-ml-2 rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Pages have their own title, so the bar shows the app name. */}
              <h2 className="truncate text-lg font-semibold lg:text-xl">
                <span className="lg:hidden">Satyakrupa Stock</span>
                <span className="hidden lg:inline">Stock</span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden truncate text-sm text-gray-600 md:inline">{user.email}</span>
              <Button variant="outline" className="hidden lg:inline-flex" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
