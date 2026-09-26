-- ============================================================
--  ADD FIRM NAME (client) TO SALES  — Phase 1 of AI style recos
--  Paste into Supabase → SQL Editor → Run. Safe to run again.
-- ============================================================

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS firm_name TEXT;

-- Speeds up the firm-name auto-suggest and per-firm style lookups.
CREATE INDEX IF NOT EXISTS stock_items_firm_name_idx ON stock_items (firm_name);
