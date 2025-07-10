// components/product-form.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, ColorVariant } from "@/types/product";
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
import ColorVariantUpload from "@/components/color-variant-upload";
import { Category, getCategories } from "@/lib/supabase/categories";

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
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
    hasColorVariants: false,
    colorVariants: [],
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  // Track files for each color variant
  const [colorVariantFiles, setColorVariantFiles] = useState<Record<number, File[]>>({});

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      }
    };

    fetchCategories();
  }, []);

  // Fetch existing product if in edit mode
  useEffect(() => {
    if (productId) {
      const fetchProduct = async () => {
        try {
          const data = await getProduct(productId);
          
          // Check if this product has color variants by looking for our special prefix
          const hasVariants = data.color?.startsWith("VARIANTS:");
          
          if (hasVariants && data.color) {
            // Extract the color variants from the special format
            const colorString = data.color.replace("VARIANTS:", "");
            const colorNames = colorString.split(', ');
            
            // Create variant objects with stock distributed evenly among colors if there are multiple
            const totalStock = data.stock || 0;
            const variantCount = colorNames.length;
            const stockPerVariant = variantCount > 0 ? Math.floor(totalStock / variantCount) : 0;
            const extraStock = variantCount > 0 ? totalStock % variantCount : 0;
            
            // Now create the variants with proper stock distribution
            const simulatedVariants: ColorVariant[] = colorNames.map((color, index) => {
              // For each color variant, collect its images from the main images
              // This is a workaround since we don't have a separate color_variants table
              // We'll try to identify images for this color by checking if the image URL contains the color name
              const colorLower = color.toLowerCase();
              const variantImages = (data.images || []).filter(img => 
                img.toLowerCase().includes(colorLower)
              );
              
              return {
                color,
                // Distribute stock - first variant gets any remainder
                stock: index === 0 ? stockPerVariant + extraStock : stockPerVariant,
                // Use color-specific images if found, otherwise use main product images
                images: variantImages.length > 0 ? variantImages : [],
              };
            });
            
            // Update the product with variants
            data.hasColorVariants = true;
            data.colorVariants = simulatedVariants;
            // Remove the prefix from the visible color field
            data.color = "";
          } else {
            data.hasColorVariants = false;
          }
          
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
    const { name, value, type } = e.target;
    
    // Handle checkbox for color variants
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setProduct({
        ...product,
        [name]: checked,
        colorVariants: checked && !product.colorVariants?.length ? [{ color: '', images: [], stock: 0 }] : product.colorVariants
      });
      return;
    }
    
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

  const handleColorVariantsChange = (variants: ColorVariant[]) => {
    setProduct({
      ...product,
      colorVariants: variants
    });
  };

  const handleVariantFilesChange = (index: number, files: File[]) => {
    setColorVariantFiles(prev => ({
      ...prev,
      [index]: files
    }));
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
        setLoading(false);
        return;
      }

      // If using color variants, ensure at least one color has a name
      if (product.hasColorVariants && product.colorVariants?.length) {
        const hasNamedColor = product.colorVariants.some(variant => variant.color.trim() !== '');
        if (!hasNamedColor) {
          toast({
            title: "Error",
            description: "At least one color variant must have a name",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Upload main product images if any - these will be used as fallback and primary images
      let allImageUrls = [...existingImages];
      
      if (imageFiles.length > 0) {
        try {
          const newImageUrls = await uploadProductImages(imageFiles);
          allImageUrls = [...allImageUrls, ...newImageUrls];
        } catch (error) {
          console.error("Error uploading images:", error);
          toast({
            title: "Error",
            description: "Failed to upload product images. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Create a product data object that can be safely submitted to Supabase
      // Only include fields that definitely exist in the database table
      const productData = {
        name: product.name,
        description: product.description,
        category: product.category,
        price: Number(product.price),
        material: product.material,
        dimensions: product.dimensions,
        weight: product.weight,
        images: allImageUrls,
        // Remove hasColorVariants from the data sent to Supabase
        // hasColorVariants: product.hasColorVariants,
      } as Partial<Product>;

      // In a real implementation, we'd have a separate color_variants table
      // For this implementation, we'll store color variant info in the main product
      if (product.hasColorVariants && product.colorVariants?.length) {
        try {
          // Let's process any color variant image uploads
          const updatedColorVariants = [...(product.colorVariants || [])];
          
          // Since we don't have a separate table for these, we can't actually store
          // separate images per color. In a production system, you'd have a color_variants table.
          // For now, we'll just add all variant images to the main product images
          
          for (const [index, variant] of updatedColorVariants.entries()) {
            // If there are files for this color variant, upload them
            if (colorVariantFiles[index]?.length > 0) {
              // Rename files before upload to include color name in the filename
              // This helps us identify which images belong to which color
              const renamedFiles = colorVariantFiles[index].map(file => {
                // Create a clean color name (lowercase, no spaces)
                const colorName = variant.color.trim().toLowerCase().replace(/\s+/g, '-');
                
                // Get file extension
                const ext = file.name.split('.').pop();
                
                // Create a new filename with color name included
                const newName = `${colorName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
                
                // Create a new file with the renamed filename
                return new File([file], newName, { type: file.type });
              });
              
              // Upload the renamed files
              const variantImageUrls = await uploadProductImages(renamedFiles);
              
              // Add these images to the main product images too
              productData.images = [...(productData.images || []), ...variantImageUrls];
              
              // Store them with the variant (this won't persist to DB yet, but will be in the UI)
              updatedColorVariants[index] = {
                ...variant,
                images: [...(variant.images || []), ...variantImageUrls]
              };
            }
          }
          
          // Update the color variants in state so we see the images immediately
          setProduct({
            ...product,
            colorVariants: updatedColorVariants
          });
          
          // Calculate total stock from all variants
          productData.stock = updatedColorVariants.reduce((total, variant) => 
            total + (variant.stock || 0), 0);
          
          // Store all color data with our special format
          const colorVariantsData = updatedColorVariants
            .filter(v => v.color.trim() !== '');
            
          if (colorVariantsData.length > 0) {
            // Store just the color names with our special prefix
            productData.color = "VARIANTS:" + colorVariantsData.map(v => v.color).join(', ');
          } else {
            // No valid colors specified
            productData.color = "";
          }
        } catch (error) {
          console.error("Error processing color variant images:", error);
          toast({
            title: "Error",
            description: "Failed to upload one or more color variant images.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      } else {
        // Not using color variants - use the main stock field
        productData.stock = Number(product.stock);
        productData.color = product.color;
      }

      let savedProduct;
      if (productId) {
        // Update existing product
        savedProduct = await updateProduct(productId, productData);
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        // Add new product
        savedProduct = await addProduct(productData as Omit<Product, "id">);
        toast({
          title: "Success",
          description: "Product added successfully",
        });
      }

      // In a real implementation, you would save the color variants to a separate table
      // For example:
      // if (product.hasColorVariants && savedProduct?.id) {
      //   for (const [index, variant] of product.colorVariants.entries()) {
      //     if (variant.color.trim() === '') continue;
      //     
      //     // Upload variant-specific images
      //     let variantImageUrls = [...variant.images];
      //     if (colorVariantFiles[index]?.length) {
      //       const newVariantImageUrls = await uploadProductImages(colorVariantFiles[index]);
      //       variantImageUrls = [...variantImageUrls, ...newVariantImageUrls];
      //     }
      //     
      //     // Save to color_variants table
      //     await supabase.from('color_variants').insert({
      //       product_id: savedProduct.id,
      //       color: variant.color,
      //       images: variantImageUrls,
      //       stock: variant.stock
      //     });
      //   }
      // }

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
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
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

        {/* Only show the main stock field if NOT using color variants */}
        {!product.hasColorVariants && (
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
        )}

        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            name="material"
            value={product.material || ''}
            onChange={handleInputChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Main Color</Label>
          <Input
            id="color"
            name="color"
            value={product.color || ''}
            onChange={handleInputChange}
            disabled={product.hasColorVariants}
            placeholder={product.hasColorVariants ? "Using color variants instead" : "e.g., Blue, Red, Green"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dimensions">Dimensions</Label>
          <Input
            id="dimensions"
            name="dimensions"
            value={product.dimensions || ''}
            onChange={handleInputChange}
            placeholder="e.g., 6.3m x 1.2m"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight">Weight (grams)</Label>
          <Input
            id="weight"
            name="weight"
            value={product.weight || ''}
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
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="hasColorVariants"
            name="hasColorVariants"
            checked={product.hasColorVariants}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="hasColorVariants" className="font-medium">
            This product has multiple color variants
          </Label>
        </div>
        <p className="text-sm text-gray-500">
          Enable this option if this product comes in different colors with specific images for each color.
        </p>
      </div>

      {product.hasColorVariants ? (
        <ColorVariantUpload
          colorVariants={product.colorVariants || []}
          onColorVariantsChange={handleColorVariantsChange}
          onVariantFilesChange={handleVariantFilesChange}
        />
      ) : (
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