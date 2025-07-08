// types/product.ts
export interface ColorVariant {
  color: string;
  images: string[];
  stock: number;
}

export interface Product {
    id?: string;
    name: string;
    description: string;
    category: string; // This should be "category" not "categoryId"
    price: number;
    stock: number;
    material?: string;
    color?: string; // Main color (for backward compatibility)
    dimensions?: string;
    weight?: string;
    images: string[]; // Main product images
    colorVariants?: ColorVariant[]; // Color variants with separate images
    created_at?: string;
    updated_at?: string;
    featured_id?: string;  // ID when product is in featured collection
    hasColorVariants?: boolean; // Flag to indicate if product has color variants
    details?: string; // Detailed product information
  }