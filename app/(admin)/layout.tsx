// app/(admin)/layout.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait until component is mounted to access browser APIs
  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [mounted, user, router]);

  // Don't render anything until mounted
  if (!mounted) return null;

  // If not logged in, don't render anything (redirect is handled in useEffect)
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Safely check if pathname matches or includes a string
  const isActive = (path: string) => pathname === path;
  const includesPath = (path: string) => pathname ? pathname.includes(path) : false;

  // Get page title safely
  const getPageTitle = () => {
    if (!pathname) return "";
    
    if (pathname === "/dashboard") return "Dashboard";
    if (includesPath("/products")) return "Products";
    if (includesPath("/categories")) return "Categories";
    if (includesPath("/orders")) return "Orders";
    if (includesPath("/inventory")) return "Inventory";
    if (includesPath("/collections")) return "Collections";
    if (includesPath("/stock-out")) return "Stock Out";
    if (includesPath("/sell")) return "Sell";
    if (includesPath("/labels")) return "QR Labels";
    return "";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-xl font-bold">Satyakrupa Silks Admin</h1>
        </div>
        <nav className="mt-6">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className={`block px-4 py-2 ${
                  isActive("/dashboard")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/products"
                className={`block px-4 py-2 ${
                  includesPath("/products")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Products
              </Link>
            </li>
            <li>
              <Link
                href="/categories"
                className={`block px-4 py-2 ${
                  includesPath("/categories")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Categories
              </Link>
            </li>
            <li>
              <Link
                href="/contact-messages"
                className={`block px-4 py-2 ${
                  includesPath("/contact-messages")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Contact Messages
              </Link>
            </li>
            <li>
              <Link
                href="/featured-collection"
                className={`block px-4 py-2 ${
                  includesPath("/featured-collection")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Featured Collection
              </Link>
            </li>
            <li>
              <Link
                href="/orders"
                className={`block px-4 py-2 ${
                  includesPath("/orders")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Orders
              </Link>
            </li>
            <li>
              <Link
                href="/inventory"
                className={`block px-4 py-2 ${
                  includesPath("/inventory")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Inventory
              </Link>
            </li>
            <li>
              <Link
                href="/collections"
                className={`block px-4 py-2 ${
                  includesPath("/collections")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Collections
              </Link>
            </li>
            <li>
              <Link
                href="/sell"
                className={`block px-4 py-2 ${
                  includesPath("/sell")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                Sell (Scan)
              </Link>
            </li>
            <li>
              <Link
                href="/labels"
                className={`block px-4 py-2 ${
                  includesPath("/labels")
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                QR Labels
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <header className="bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {getPageTitle()}
            </h2>
            <div className="flex items-center gap-4">
              <span>{user.email}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
