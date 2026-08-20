"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/role";

const NAV = [
  { href: "/staff/dashboard", label: "Dashboard" },
  { href: "/staff/inventory", label: "Inventory" },
  { href: "/staff/collections", label: "Collections", adminOnly: true },
  { href: "/staff/sell", label: "Sell (Scan)" },
  { href: "/staff/labels", label: "QR Labels" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) router.push("/login");
  }, [mounted, user, router]);

  if (!mounted || !user) return null;

  const admin = isAdminEmail(user.email);
  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-xl font-bold">Satyakrupa Stock</h1>
        </div>
        <nav className="mt-6">
          <ul>
            {NAV.filter((n) => admin || !n.adminOnly).map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`block px-4 py-2 ${
                    pathname?.startsWith(n.href) ? "bg-primary text-white" : "hover:bg-gray-100"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            {admin && (
              <li className="mt-4 border-t pt-4">
                <Link href="/products" className="block px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">
                  Website Admin →
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="flex-1">
        <header className="bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Stock</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
