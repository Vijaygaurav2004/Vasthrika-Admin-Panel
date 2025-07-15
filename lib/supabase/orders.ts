// lib/supabase/orders.ts
import { supabase, isSupabaseClient } from './client';
import { Purchase } from '@/types/order';

// Get all user purchases
export async function getPurchases() {
  try {
    if (!isSupabaseClient(supabase)) return [];
    
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*')
      .order('purchase_date', { ascending: false });
    
    if (error) {
      console.error("Error getting purchases:", error);
      return [];
    }
    
    return data as Purchase[];
  } catch (error) {
    console.error("Error getting purchases:", error);
    return [];
  }
}

// Get a single purchase
export async function getPurchase(id: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error("Purchase not found");
    }
    
    return data as Purchase;
  } catch (error) {
    console.error("Error getting purchase:", error);
    throw error;
  }
}

// Update purchase status
export async function updatePurchaseStatus(id: string, status: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase
      .from('user_purchases')
      .update({
        status
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error("Error updating purchase status:", error);
    throw error;
  }
}

// Delete a purchase
export async function deletePurchase(id: string) {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { error } = await supabase
      .from('user_purchases')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting purchase:", error);
    throw error;
  }
}

// Delete all purchases
export async function deleteAllPurchases() {
  try {
    if (!isSupabaseClient(supabase)) throw new Error("Supabase client not initialized");
    
    const { error } = await supabase
      .from('user_purchases')
      .delete()
      .neq('id', ''); // This will delete all records
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting all purchases:", error);
    throw error;
  }
} 