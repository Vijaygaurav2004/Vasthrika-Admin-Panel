// components/admin/featured-collection-manager.tsx
"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types/product";
import { getProducts } from "@/lib/supabase/products";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FeaturedCollectionManager() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get all products
      const productsData = await getProducts();
      setProducts(productsData);
      
      // Get featured products from the database
      if (!supabase) throw new Error("Supabase client not initialized");
      
      const { data: featuredData, error } = await supabase
        .from("featured_products")
        .select("*, product_id");
      
      if (error) throw error;
      
      // Match the featured product IDs with the product details
      const featuredItems = featuredData
        .map(item => {
          const product = productsData.find(p => p.id === item.product_id);
          return product ? { ...product, featured_id: item.id } : null;
        })
        .filter(Boolean) as Product[];
      
      setFeaturedProducts(featuredItems);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load products and featured collection data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToFeaturedCollection = async (product: Product) => {
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      
      // Check if the product is already in the featured collection
      const isAlreadyFeatured = featuredProducts.some(p => p.id === product.id);
      
      if (isAlreadyFeatured) {
        toast({
          title: "Info",
          description: "This product is already in the featured collection",
        });
        return;
      }
      
      // Check if we've reached the maximum number of featured products (3-6 is common)
      if (featuredProducts.length >= 6) {
        toast({
          title: "Warning",
          description: "Maximum number of featured products reached. Please remove a product before adding a new one.",
          variant: "destructive",
        });
        return;
      }
      
      // Add to featured collection
      const { data, error } = await supabase
        .from("featured_products")
        .insert([
          { product_id: product.id, order: featuredProducts.length + 1 }
        ])
        .select()
        .single();
      
      if (error) throw error;
      
      // Update the local state
      setFeaturedProducts([...featuredProducts, { ...product, featured_id: data.id }]);
      
      toast({
        title: "Success",
        description: "Product added to featured collection",
      });
    } catch (error) {
      console.error("Error adding to featured collection:", error);
      toast({
        title: "Error",
        description: "Failed to add product to featured collection",
        variant: "destructive",
      });
    }
  };

  const removeFromFeaturedCollection = async (product: Product) => {
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      
      const featuredId = product.featured_id;
      
      if (!featuredId) {
        toast({
          title: "Error",
          description: "Featured ID not found for this product",
          variant: "destructive",
        });
        return;
      }
      
      // Remove from featured collection
      const { error } = await supabase
        .from("featured_products")
        .delete()
        .eq("id", featuredId);
      
      if (error) throw error;
      
      // Update the local state
      setFeaturedProducts(featuredProducts.filter(p => p.id !== product.id));
      
      toast({
        title: "Success",
        description: "Product removed from featured collection",
      });
      
      // Reorder the remaining featured products
      await reorderFeaturedProducts();
    } catch (error) {
      console.error("Error removing from featured collection:", error);
      toast({
        title: "Error",
        description: "Failed to remove product from featured collection",
        variant: "destructive",
      });
    }
  };

  const reorderFeaturedProducts = async () => {
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      
      // Update the order of all featured products
      const updatePromises = featuredProducts.map((product, index) => {
        return supabase
          .from("featured_products")
          .update({ order: index + 1 })
          .eq("id", product.featured_id);
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error reordering featured products:", error);
    }
  };

  const moveProductPosition = async (product: Product, direction: 'up' | 'down') => {
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      
      const currentIndex = featuredProducts.findIndex(p => p.id === product.id);
      if (currentIndex === -1) return;
      
      // Calculate the new index
      const newIndex = direction === 'up' 
        ? Math.max(0, currentIndex - 1) 
        : Math.min(featuredProducts.length - 1, currentIndex + 1);
      
      // If the index didn't change, no need to do anything
      if (newIndex === currentIndex) return;
      
      // Create a new array with the product in the new position
      const reorderedProducts = [...featuredProducts];
      const [removedProduct] = reorderedProducts.splice(currentIndex, 1);
      reorderedProducts.splice(newIndex, 0, removedProduct);
      
      // Update the state
      setFeaturedProducts(reorderedProducts);
      
      // Update the order in the database
      const updatePromises = reorderedProducts.map((p, index) => {
        return supabase
          .from("featured_products")
          .update({ order: index + 1 })
          .eq("id", p.featured_id);
      });
      
      await Promise.all(updatePromises);
      
      toast({
        title: "Success",
        description: "Featured product order updated",
      });
    } catch (error) {
      console.error("Error reordering featured products:", error);
      toast({
        title: "Error",
        description: "Failed to update product order",
        variant: "destructive",
      });
      
      // Reload data to reset the state
      loadData();
    }
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Featured Collection</h2>
        <p className="text-muted-foreground mb-6">
          Manage the products that appear in the featured collection on the homepage.
        </p>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Current Featured Products</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p>Loading featured products...</p>
              </div>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No featured products selected</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add products from the list below to feature them on the homepage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featuredProducts.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{index + 1}</span>
                          <div className="flex flex-col gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => moveProductPosition(product, 'up')}
                              disabled={index === 0}
                              className="h-7 w-7 p-0"
                            >
                              ↑
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => moveProductPosition(product, 'down')}
                              disabled={index === featuredProducts.length - 1}
                              className="h-7 w-7 p-0"
                            >
                              ↓
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative h-12 w-12">
                          <Image
                            src={product.images?.[0] || "/placeholder.svg"}
                            alt={product.name}
                            fill
                            sizes="48px"
                            className="rounded-sm object-cover"
                            priority={false}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>₹{product.price.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFromFeaturedCollection(product)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-6 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Add to Featured Collection</h3>
        <div className="flex mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              <p>Loading products...</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts
                .filter(product => !featuredProducts.some(fp => fp.id === product.id))
                .map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="relative h-12 w-12">
                        <Image
                          src={product.images?.[0] || "/placeholder.svg"}
                          alt={product.name}
                          fill
                          sizes="48px"
                          className="rounded-sm object-cover"
                          priority={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>₹{product.price.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addToFeaturedCollection(product)}
                      >
                        Add to Featured
                      </Button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}