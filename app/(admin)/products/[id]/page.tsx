// app/(admin)/products/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import ProductForm from "@/components/product-form";
import { Button } from "@/components/ui/button";

export default function EditProductPage() {
  const params = useParams();
  // Handle params properly with type safety
  const productId = params?.id ? 
    // Handle both string and string array cases
    Array.isArray(params.id) ? params.id[0] : params.id 
    : "";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <Button variant="outline" asChild>
          <Link href={`/products/${productId}/details`}>Manage Product Details</Link>
        </Button>
      </div>
      <ProductForm productId={productId} />
    </div>
  );
}