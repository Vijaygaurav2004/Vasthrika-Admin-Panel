"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/staff/dashboard");
    } else {
      router.push("/login");
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}
