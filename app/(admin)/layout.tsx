// app/(admin)/layout.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { isAdminUser } from "@/lib/role";

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/featured-collection", label: "Featured Collection" },
  { href: "/orders", label: "Orders" },
  { href: "/contact-messages", label: "Contact Messages" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.push("/login");
    } else if (!isAdminUser(user)) {
      // Staff cannot see the website admin — send them to the stock app.
      router.push("/staff/dashboard");
    }
  }, [mounted, user, router]);

  if (!mounted || !user || !isAdminUser(user)) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-xl font-bold">Satyakrupa Admin</h1>
        </div>
        <nav className="mt-6">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`block px-4 py-2 ${
                    pathname?.includes(n.href) ? "bg-primary text-white" : "hover:bg-gray-100"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="mt-4 border-t pt-4">
              <Link href="/staff/dashboard" className="block px-4 py-2 text-sm font-medium text-primary hover:bg-gray-100">
                ← Stock App
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex-1">
        <header className="bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Website Admin</h2>
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
