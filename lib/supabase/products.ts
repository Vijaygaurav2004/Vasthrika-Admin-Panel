import { supabase, isSupabaseClient } from './client';
import { Product } from '@/types/product';

// Get all products
export async function getProducts(categoryFilter?: string) {
  try {
    if (!isSupabaseClient(supabase)) return [];
    
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return data as Product[];
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
}

// Get a single product
export async function getProduct(id: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error("Product not found");
    }
    
    return data as Product;
  } catch (error) {
    console.error("Error getting product:", error);
    throw error;
  }
}

// Ensure products bucket exists
async function ensureProductsBucket() {
  if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
  
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const productsBucket = buckets?.find(b => b.name === 'products');
    
    if (!productsBucket) {
      // Create the bucket if it doesn't exist
      const { error } = await supabase.storage.createBucket('products', {
        public: true,
        fileSizeLimit: 5242880, // 5MB in bytes
      });
      
      if (error) throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error ensuring products bucket:", error);
    throw error;
  }
}

// Upload product images
export async function uploadProductImages(files: File[]) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    const client = supabase;
    
    // Ensure bucket exists before uploading
    await ensureProductsBucket();
    
    const uploadPromises = files.map(async (file) => {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = fileName;
        
        const { error: uploadError } = await client.storage
          .from('products')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw uploadError;
        }
        
        const { data } = client.storage
          .from('products')
          .getPublicUrl(filePath);
        
        if (!data?.publicUrl) {
          throw new Error("Failed to get public URL");
        }
        
        return data.publicUrl;
      } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
      }
    });
    
    return Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error in uploadProductImages:", error);
    throw error;
  }
}

// Add a new product
export async function addProduct(product: Omit<Product, "id">) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...product,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data as Product;
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
}

// Update a product
export async function updateProduct(id: string, updates: Partial<Product>) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data as Product;
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

// Delete a product
export async function deleteProduct(id: string, images: string[] = []) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    const client = supabase;
    
    // First, delete the product document
    const { error } = await client
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    // Ensure bucket exists before attempting to delete images
    await ensureProductsBucket();
    
    // Then, delete associated images from storage
    const deletePromises = images.map(async (url) => {
      if (!url) return;
      
      try {
        // Extract the path from the URL
        const filePath = url.split('/').pop(); // Get just the filename
        if (!filePath) return;
        
        const { error: deleteError } = await client.storage
          .from('products')
          .remove([filePath]);
        
        if (deleteError) {
          console.error("Error deleting image:", deleteError);
        }
      } catch (error) {
        console.error("Error deleting image:", error);
        // Continue with other deletions even if one fails
      }
    });
    
    await Promise.all(deletePromises);
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
} 