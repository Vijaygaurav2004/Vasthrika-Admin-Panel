// components/product-form.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types/product";
import { 
  getProduct, 
  addProduct as createProduct, 
  updateProduct, 
  uploadProductImages
} from "@/lib/firebase/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Partial<Product>>({
    name: "",
    description: "",
    category: "",
    price: 0,
    stock: 0,
    material: "",
    color: "",
    dimensions: "",
    weight: "",
    images: [],
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  // Fetch existing product if in edit mode
  useEffect(() => {
    if (productId) {
      const fetchProduct = async () => {
        try {
          const data = await getProduct(productId);
          setProduct(data);
          setExistingImages(data.images || []);
        } catch (error) {
          console.error("Error fetching product:", error);
          toast({
            title: "Error",
            description: "Failed to load product details",
            variant: "destructive",
          });
        }
      };

      fetchProduct();
    }
  }, [productId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Handle number inputs
    if (name === "price" || name === "stock") {
      setProduct({
        ...product,
        [name]: value === "" ? 0 : parseFloat(value),
      });
    } else {
      setProduct({
        ...product,
        [name]: value,
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveExistingImage = (imageUrl: string) => {
    setExistingImages(existingImages.filter((url) => url !== imageUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload new images if any
      let allImageUrls = [...existingImages];
      
      if (imageFiles.length > 0) {
        const newImageUrls = await uploadProductImages(imageFiles);
        allImageUrls = [...allImageUrls, ...newImageUrls];
      }

      const productData = {
        ...product,
        images: allImageUrls,
        price: Number(product.price),
        stock: Number(product.stock),
      } as Product;

      if (productId) {
        // Update existing product
        await updateProduct(productId, productData);
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        // Add new product
        await createProduct(productData);
        toast({
          title: "Success",
          description: "Product added successfully",
        });
      }

      router.push("/products");
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            name="name"
            value={product.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
  id="category"
  name="category"
  value={product.category}
  onChange={handleInputChange}
  className="w-full rounded-md border border-input bg-background px-3 py-2"
  required
>
  <option value="">Select Category</option>
  {/* Women Categories */}
  <option value="Silk">Silk</option>
  <option value="Tissue">Tissue</option>
  <option value="Ethnic">Ethnic</option>
  <option value="Fancy">Fancy</option>
  <option value="Fabric">Fabric</option>
  {/* Men Categories */}
  <option value="Dhothi">Dhothi</option>
  <option value="Fabric">Fabric</option>
</select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price (₹)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={product.price}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock Quantity</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            value={product.stock}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            name="material"
            value={product.material}
            onChange={handleInputChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            value={product.color}
            onChange={handleInputChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dimensions">Dimensions</Label>
          <Input
            id="dimensions"
            name="dimensions"
            value={product.dimensions}
            onChange={handleInputChange}
            placeholder="e.g., 6.3m x 1.2m"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight">Weight (grams)</Label>
          <Input
            id="weight"
            name="weight"
            value={product.weight}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={product.description}
          onChange={handleInputChange}
          rows={5}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Product Images</Label>
        <Input
          id="images"
          type="file"
          multiple
          accept="image/*"
          onChange={handleImageChange}
        />
        <p className="text-sm text-gray-500">
          Upload up to 5 images. First image will be the main product image.
        </p>
      </div>

      {/* Preview existing images */}
      {existingImages.length > 0 && (
        <div>
          <Label>Existing Images</Label>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {existingImages.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Product ${index}`}
                  className="h-24 w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white"
                  onClick={() => handleRemoveExistingImage(url)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview new images */}
      {imageFiles.length > 0 && (
        <div>
          <Label>New Images</Label>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from(imageFiles).map((file, index) => (
              <div key={index} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`New ${index}`}
                  className="h-24 w-full rounded-md object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

<div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : productId ? "Update Product" : "Add Product"}
        </Button>
      </div>
    </form>
  );
}