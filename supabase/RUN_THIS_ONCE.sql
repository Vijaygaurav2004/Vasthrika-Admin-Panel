-- ============================================================
--  VASTHRIKA — ONE-TIME DATABASE SETUP
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to run more than once (nothing is duplicated or lost).
-- ============================================================

-- 1) QR code + attribute + buyer fields on stock_items ---------
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS pattern TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS fabric TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS sold_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS stock_items_code_unique
  ON stock_items (code)
  WHERE code IS NOT NULL;

-- 2) Collections (folders) table -------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to collections" ON collections;
CREATE POLICY "Allow all access to collections" ON collections
  FOR ALL USING (true) WITH CHECK (true);

-- 3) Seed folders from the iCloud albums -----------------------
INSERT INTO collections (name, sort_order) VALUES
  ('Gm04 butta', 1), ('PL Bataani', 2), ('A.b.s.s.b.k sarees', 3),
  ('BYR buttas', 4), ('Aman sarees', 5), ('BYR(new)', 6),
  ('Under 20k sarees', 7), ('MGM sarees', 8), ('Pallaki BKT', 9),
  ('KM02, km13', 10), ('Long mangoes', 11), ('Beet butta', 12),
  ('SNVT12 barder less', 13), ('20k tissues less', 14), ('KRTK', 15),
  ('2G stitching', 16), ('Full 2 cord kuttu', 17), ('Nvc19 sarees', 18),
  ('Pavadas', 19), ('Shade work', 20), ('MH double vadi bk', 21),
  ('Sarees barder less', 22), ('Pl butta less', 23), ('EMBOSE BKT tankard', 24),
  ('Tan PRB', 25), ('Aman lines sarees', 26), ('PRB''BUTTA,', 27),
  ('ASR12', 28), ('PRB..KUTU,', 29), ('GOP01', 30),
  ('AMBANI', 31), ('Pl butta', 32), ('Silver Jari', 33),
  ('PL TEMPLE.', 34), ('KM04::4card', 35), ('PL MEENA BKT', 36),
  ('SNVT.04.PARRET', 37), ('Rang Card ASR 07', 38), ('KM;04;PAITHANY', 39),
  ('EMBOSE BKT', 40), ('BUTTA', 41), ('Plain tissue', 42),
  ('J/WARP S/G', 43), ('BANDHANI', 44), ('Cantrast..EMBOJI BKT', 45),
  ('KUTTU', 46), ('PL CONTRAST 3k', 47), ('ASR09; 3cards', 48),
  ('PL SELF', 49), ('Silver gold EM', 50), ('Double Vadi Br', 51),
  ('Dhothi', 52), ('Ynkms 02', 53), ('Ynkms04', 54),
  ('ASRD NEW DESIGNS', 55), ('Ynkms03', 56), ('Temple', 57)
ON CONFLICT (name) DO NOTHING;

-- 4) QR label print log --------------------------------------
CREATE TABLE IF NOT EXISTS qr_print_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT,
  from_number INTEGER,
  to_number INTEGER,
  count INTEGER,
  printed_by TEXT,
  printed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE qr_print_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to qr_print_log" ON qr_print_log;
CREATE POLICY "Allow all access to qr_print_log" ON qr_print_log
  FOR ALL USING (true) WITH CHECK (true);
