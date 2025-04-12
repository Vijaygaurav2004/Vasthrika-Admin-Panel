// types/product.ts
export interface Product {
    id?: string;
    name: string;
    description: string;
    category: string; // This should be "category" not "categoryId"
    price: number;
    stock: number;
    material?: string;
    color?: string;
    dimensions?: string;
    weight?: string;
    images: string[]; // This should be "images" as an array, not "imageUrl"
    createdAt?: any;
    updatedAt?: any;
  }