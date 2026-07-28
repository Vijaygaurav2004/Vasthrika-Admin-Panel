-- Run this in the Supabase SQL Editor.
-- Adds QR code + attribute + buyer fields to the existing stock_items table.

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS pattern TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS fabric TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

-- Each saree's QR code must be unique (multiple NULLs allowed for un-coded items).
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_code_unique
  ON stock_items (code)
  WHERE code IS NOT NULL;
