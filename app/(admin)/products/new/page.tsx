// app/(admin)/products/new/page.tsx
"use client";

import ProductForm from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Add New Product</h1>
      <ProductForm />
    </div>
  );
}