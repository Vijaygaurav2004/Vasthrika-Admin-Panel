import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-xl text-gray-600">Page not found</p>
      <Button asChild>
        <Link href="/">Go back home</Link>
      </Button>
    </div>
  );
} 