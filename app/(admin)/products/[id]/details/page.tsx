// app/(admin)/products/[id]/details/page.tsx
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import ProductDetailsManager from "@/components/admin/product-details-manager";
import { Button } from "@/components/ui/button";

export default function ProductDetailsPage() {
  const params = useParams();
  // Handle params properly with type safety
  const productId = params?.id ? 
    // Handle both string and string array cases
    Array.isArray(params.id) ? params.id[0] : params.id 
    : "";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Product Details</h1>
        <Button variant="outline" asChild>
          <Link href={`/products/${productId}`}>Back to Product</Link>
        </Button>
      </div>
      
      <ProductDetailsManager productId={productId} />
    </div>
  );
} 