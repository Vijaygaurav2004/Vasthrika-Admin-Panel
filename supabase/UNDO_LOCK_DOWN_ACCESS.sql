-- ============================================================
--  EMERGENCY ONLY — undo supabase/LOCK_DOWN_ACCESS.sql
--  Re-opens stock, folders and the QR print log to ANYONE with the public
--  key (the old, unsafe setup). Use only if the app breaks after the
--  lock-down, then run LOCK_DOWN_ACCESS.sql again once it's fixed.
--  Storage photo rules are left locked (nothing in the app needs them open).
--  Paste into Supabase → SQL Editor → Run. Safe to run again.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_items', 'collections', 'qr_print_log'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "Owner and staff only" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all access to ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Allow all access to ' || t, t);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS stock_items_price_owner_only ON public.stock_items;
