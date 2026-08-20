-- Run this in the Supabase SQL Editor.
-- Records which staff member added / sold each saree (for the admin activity view).
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS sold_by TEXT;
