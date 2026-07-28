-- Run this in Supabase SQL Editor
-- Drop policy first if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow all access to stock_items" ON stock_items;

CREATE TABLE IF NOT EXISTS stock_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image TEXT NOT NULL,
  label TEXT,
  category TEXT,
  notes TEXT,
  ai_description TEXT,
  status TEXT DEFAULT 'in_stock',
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to stock_items" ON stock_items
  FOR ALL USING (true) WITH CHECK (true);
