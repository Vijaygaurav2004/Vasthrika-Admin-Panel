// app/(admin)/layout.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // If not logged in, redirect to login page
  if (!user) {
    router.push("/login");
    return null;
  }

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
    return "";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-xl font-bold">Vasthrika Admin</h1>
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