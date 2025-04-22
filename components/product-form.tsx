// components/product-form.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types/product";
import { 
  getProduct, 
  addProduct, 
  updateProduct, 
  uploadProductImages
} from "@/lib/supabase/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import DragDropUpload from "@/components/drag-drop-upload";

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

  const handleImageChange = (filesOrUpdater: File[] | ((prevFiles: File[]) => File[])) => {
    if (typeof filesOrUpdater === 'function') {
      setImageFiles(filesOrUpdater);
    } else {
      setImageFiles(filesOrUpdater);
    }
  };

  const handleRemoveExistingImage = (imageUrl: string) => {
    setExistingImages(existingImages.filter((url) => url !== imageUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!product.name || !product.description || !product.category || !product.price || product.price <= 0) {
        toast({
          title: "Error",
          description: "Please fill in all required fields with valid values",
          variant: "destructive",
        });
        return;
      }

      // Upload new images if any
      let allImageUrls = [...existingImages];
      
      if (imageFiles.length > 0) {
        try {
          const newImageUrls = await uploadProductImages(imageFiles);
          allImageUrls = [...allImageUrls, ...newImageUrls];
        } catch (error) {
          console.error("Error uploading images:", error);
          toast({
            title: "Error",
            description: "Failed to upload images. Please try again.",
            variant: "destructive",
          });
          return;
        }
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
        await addProduct(productData);
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
        description: "Failed to save product. Please try again.",
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
        <Label>Product Images</Label>
        <DragDropUpload
          onFilesSelected={handleImageChange}
          existingImages={existingImages}
          onRemoveExistingImage={handleRemoveExistingImage}
          maxFiles={5}
        />
        <p className="text-sm text-gray-500">
          Upload up to 5 images. First image will be the main product image.
        </p>
      </div>

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