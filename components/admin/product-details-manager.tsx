// components/admin/product-details-manager.tsx
"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types/product";
import { getProduct, updateProduct } from "@/lib/supabase/products";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface ProductDetailsManagerProps {
  productId: string;
}

export default function ProductDetailsManager({ productId }: ProductDetailsManagerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      
      setLoading(true);
      try {
        const data = await getProduct(productId);
        setProduct(data);
        // Initialize product details from the description or empty string
        setProductDetails(data.details || "");
      } catch (error) {
        console.error("Error fetching product:", error);
        toast({
          title: "Error",
          description: "Failed to load product details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const handleDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProductDetails(e.target.value);
    // Reset success state when user starts editing again
    if (saveSuccess) {
      setSaveSuccess(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!product) return;
    
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      await updateProduct(productId, {
        details: productDetails,
      });
      
      // Show success toast
      toast({
        title: "Success",
        description: "Product details saved successfully",
      });
      
      // Set success state for visual feedback
      setSaveSuccess(true);
      
      // Update the product in state
      setProduct({
        ...product,
        details: productDetails
      });
      
    } catch (error) {
      console.error("Error saving product details:", error);
      toast({
        title: "Error",
        description: "Failed to save product details",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xl font-semibold">Product Details</h2>
      <p className="mb-4 text-sm text-gray-500">
        Add detailed information about the product that will be displayed on the product page.
      </p>
      
      <div className="space-y-4">
        <Textarea
          value={productDetails}
          onChange={handleDetailsChange}
          rows={10}
          placeholder="Enter product details here... Include information about craftsmanship, materials, special features, etc."
          className="min-h-[200px]"
        />
        
        <div className="flex items-center justify-between">
          <Button 
            onClick={handleSaveDetails} 
            disabled={saving}
            className="w-full"
          >
            {saving ? "Saving..." : "Save Details"}
          </Button>
          
          {saveSuccess && (
            <div className="ml-4 flex items-center text-green-600">
              <CheckCircle className="mr-1 h-5 w-5" />
              <span>Saved successfully!</span>
            </div>
          )}
        </div>
        
        {saveSuccess && (
          <div className="mt-2 rounded-md bg-green-50 p-3 text-green-700">
            <p className="flex items-center">
              <CheckCircle className="mr-2 h-5 w-5" />
              Product details have been saved successfully!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
} 