"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for the saved session, or a logged-in user always lands on /login.
    if (loading) return;
    if (user) {
      router.push("/staff/dashboard");
    } else {
      router.push("/login");
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}
