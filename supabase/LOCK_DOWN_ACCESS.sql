-- ============================================================
--  VASTHRIKA — LOCK DOWN DATA ACCESS
--
--  Until now anyone holding the app's public key (it ships inside every
--  browser) could read every saree, change it or delete it without logging
--  in. After this:
--    * Stock, folders and the QR print log: only the owner and active staff,
--      logged in. Logged-out visitors and strangers who sign themselves up
--      get nothing.
--    * Price: only the owner can see or set it.
--    * Photos in Supabase storage: anyone can still VIEW them (the website
--      needs that); only owner/staff can upload, replace or delete.
--
--  RUN THIS ONLY AFTER the app update that sends logins to the server is
--  live. Run earlier, Add stock / Bulk Add / Sell stop working until it is.
--
--  Paste the whole file into Supabase → SQL Editor → Run. Safe to run again.
--  RE-RUN IT after adding a column to stock_items, or logged-in users can't
--  read the new column.
--
--  Emergency undo: supabase/UNDO_LOCK_DOWN_ACCESS.sql
-- ============================================================


-- 1) Who is calling? ------------------------------------------------
-- Mirrors roleOf() in lib/role.ts — keep the email lists in sync with it.
-- Reads the login's token: its email, and app_metadata (which only the
-- server can write, so nobody can make themselves staff).
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN c.email = '' THEN 'none'
    -- owner: can never be locked out
    WHEN c.email = ANY (ARRAY['skssatya@gmail.com']) THEN 'owner'
    -- deactivated in Manage staff
    WHEN c.meta -> 'active' = 'false'::jsonb THEN 'removed'
    -- original logins whose access was removed (until reactivated)
    WHEN c.email = ANY (ARRAY['sai@satyakrupa.com', 'murthy@satyakrupa.com'])
         AND c.meta -> 'active' IS DISTINCT FROM 'true'::jsonb THEN 'removed'
    -- tagged staff by the owner, or on the original staff list
    WHEN c.meta ->> 'role' = 'staff'
         OR c.email = ANY (ARRAY['sai@satyakrupa.com', 'arun@satyakrupa.com',
                                 'govardan@satyakrupa.com', 'murthy@satyakrupa.com']) THEN 'staff'
    ELSE 'none'
  END
  FROM (
    SELECT lower(trim(coalesce(auth.jwt() ->> 'email', ''))) AS email,
           coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb) AS meta
  ) AS c
$$;

CREATE OR REPLACE FUNCTION public.is_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT public.app_role() IN ('owner', 'staff') $$;


-- 2) Stock, folders, QR print log: owner + active staff only. ----------
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_items', 'collections', 'qr_print_log'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Remove every existing rule (incl. the old "Allow all access" ones)...
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    -- ...and let in only logged-in owner/staff.
    EXECUTE format(
      'CREATE POLICY "Owner and staff only" ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT public.is_app_user())) WITH CHECK ((SELECT public.is_app_user()))', t);
    -- Logged out: refused outright (an error, not an empty list).
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;


-- 3) Price: owner only. -----------------------------------------------
-- Logged-in users can read every stock_items column EXCEPT price. (So the app
-- must never select "*" on stock_items — it lists columns instead.)
DO $$
DECLARE
  cols text;
BEGIN
  REVOKE SELECT ON public.stock_items FROM authenticated;  -- also clears old per-column grants
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'stock_items' AND column_name <> 'price';
  EXECUTE format('GRANT SELECT (%s) ON public.stock_items TO authenticated', cols);
END $$;

-- The owner reads prices through this; it returns nothing for anyone else.
CREATE OR REPLACE FUNCTION public.stock_item_prices()
RETURNS TABLE (id uuid, price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id::uuid, s.price::numeric
    FROM public.stock_items AS s
   WHERE s.price IS NOT NULL
     AND public.app_role() = 'owner'
$$;
REVOKE ALL ON FUNCTION public.stock_item_prices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_item_prices() TO authenticated;

-- Only the owner can set or change a price (staff saves never touch it).
CREATE OR REPLACE FUNCTION public.stock_items_price_owner_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  before_price numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    before_price := OLD.price;
  END IF;
  IF current_user = 'authenticated'
     AND NEW.price IS DISTINCT FROM before_price
     AND public.app_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can set a price' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS stock_items_price_owner_only ON public.stock_items;
CREATE TRIGGER stock_items_price_owner_only
  BEFORE INSERT OR UPDATE OF price ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.stock_items_price_owner_only();


-- 4) Photos in Supabase storage (bucket "products"). ------------------
-- Stock photos live in Cloudflare R2 now; this covers the website's product
-- photos. If Supabase doesn't allow changing storage rules from here, this
-- part is skipped and everything above still applies.
DO $$
DECLARE
  p record;
BEGIN
  -- Remove every rule that lets someone other than owner/staff upload, replace
  -- or delete photos (in this bucket or any bucket), or change bucket settings.
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'storage'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       AND coalesce(qual, '') || coalesce(with_check, '') NOT LIKE '%is_app_user%'
       AND (tablename = 'buckets'
            OR (tablename = 'objects'
                AND (coalesce(qual, '') || coalesce(with_check, '') LIKE '%products%'
                     OR coalesce(qual, '') || coalesce(with_check, '') NOT LIKE '%bucket_id%')))
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.%I', p.policyname, p.tablename);
  END LOOP;

  DROP POLICY IF EXISTS "Anyone can view products photos" ON storage.objects;
  CREATE POLICY "Anyone can view products photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'products');

  DROP POLICY IF EXISTS "Owner and staff can upload products photos" ON storage.objects;
  CREATE POLICY "Owner and staff can upload products photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'products' AND (SELECT public.is_app_user()));

  DROP POLICY IF EXISTS "Owner and staff can replace products photos" ON storage.objects;
  CREATE POLICY "Owner and staff can replace products photos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'products' AND (SELECT public.is_app_user()))
    WITH CHECK (bucket_id = 'products' AND (SELECT public.is_app_user()));

  DROP POLICY IF EXISTS "Owner and staff can delete products photos" ON storage.objects;
  CREATE POLICY "Owner and staff can delete products photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'products' AND (SELECT public.is_app_user()));

  DROP POLICY IF EXISTS "Owner and staff can manage buckets" ON storage.buckets;
  CREATE POLICY "Owner and staff can manage buckets" ON storage.buckets
    FOR ALL TO authenticated
    USING ((SELECT public.is_app_user()))
    WITH CHECK ((SELECT public.is_app_user()));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Storage rules NOT changed: %', SQLERRM;
END $$;


-- 5) What's in place now (this is the result shown below). -----------
SELECT 'price hidden from staff' AS check_, 'stock_items' AS on_,
       CASE WHEN has_column_privilege('authenticated', 'public.stock_items', 'price', 'SELECT')
            THEN 'NO - still visible' ELSE 'yes' END AS result
UNION ALL
SELECT 'logged-out access', t,
       CASE WHEN has_table_privilege('anon', 'public.' || t, 'SELECT')
            THEN 'NO - still open' ELSE 'refused' END
  FROM unnest(ARRAY['stock_items', 'collections', 'qr_print_log']) AS t
 WHERE to_regclass('public.' || t) IS NOT NULL
UNION ALL
SELECT 'rule', schemaname || '.' || tablename,
       policyname || ' (' || cmd || ', ' || array_to_string(roles, ',') || ')'
  FROM pg_policies
 WHERE (schemaname = 'public' AND tablename IN ('stock_items', 'collections', 'qr_print_log'))
    OR schemaname = 'storage'
ORDER BY 1, 2, 3;
