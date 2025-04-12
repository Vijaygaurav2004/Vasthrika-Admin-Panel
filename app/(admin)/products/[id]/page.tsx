// app/(admin)/products/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import ProductForm from "@/components/product-form";

export default function EditProductPage() {
  const params = useParams();
  // Handle params properly with type safety
  const productId = params?.id ? 
    // Handle both string and string array cases
    Array.isArray(params.id) ? params.id[0] : params.id 
    : "";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit Product</h1>
      <ProductForm productId={productId} />
    </div>
  );
}