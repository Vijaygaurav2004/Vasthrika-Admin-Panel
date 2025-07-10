// lib/supabase/categories.ts
import { supabase, isSupabaseClient } from './client';

export type Category = {
  id: string;
  name: string;
  created_at?: string;
};

// Get all categories
export async function getCategories() {
  try {
    if (!isSupabaseClient(supabase)) return [];
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    return data as Category[];
  } catch (error) {
    console.error("Error getting categories:", error);
    throw error;
  }
}

// Add a new category
export async function addCategory(name: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error('Supabase client not available');
    
    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data as Category;
  } catch (error) {
    console.error("Error adding category:", error);
    throw error;
  }
}

// Update a category
export async function updateCategory(id: string, name: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error('Supabase client not available');
    
    const { data, error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data as Category;
  } catch (error) {
    console.error("Error updating category:", error);
    throw error;
  }
}

// Delete a category
export async function deleteCategory(id: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
} 