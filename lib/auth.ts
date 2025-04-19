// lib/supabase/auth.ts
import { supabase } from '@/lib/supabase/client'

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase client not initialized");
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  
  return data
}

export async function signOut() {
  if (!supabase) throw new Error("Supabase client not initialized");
  
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  if (!supabase) throw new Error("Supabase client not initialized");
  
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  
  return data.session
}