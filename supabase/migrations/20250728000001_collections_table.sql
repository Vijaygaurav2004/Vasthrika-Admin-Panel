-- Run this in the Supabase SQL Editor.
-- Creates a "collections" (folders) table and seeds it with the folder
-- names from the existing iCloud albums. Safe to re-run.

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

-- Seed folders from the shared screenshots (duplicates collapsed).
INSERT INTO collections (name, sort_order) VALUES
  ('Gm04 butta', 1),
  ('PL Bataani', 2),
  ('A.b.s.s.b.k sarees', 3),
  ('BYR buttas', 4),
  ('Aman sarees', 5),
  ('BYR(new)', 6),
  ('Under 20k sarees', 7),
  ('MGM sarees', 8),
  ('Pallaki BKT', 9),
  ('KM02, km13', 10),
  ('Long mangoes', 11),
  ('Beet butta', 12),
  ('SNVT12 barder less', 13),
  ('20k tissues less', 14),
  ('KRTK', 15),
  ('2G stitching', 16),
  ('Full 2 cord kuttu', 17),
  ('Nvc19 sarees', 18),
  ('Pavadas', 19),
  ('Shade work', 20),
  ('MH double vadi bk', 21),
  ('Sarees barder less', 22),
  ('Pl butta less', 23),
  ('EMBOSE BKT tankard', 24),
  ('Tan PRB', 25),
  ('Aman lines sarees', 26),
  ('PRB''BUTTA,', 27),
  ('ASR12', 28),
  ('PRB..KUTU,', 29),
  ('GOP01', 30),
  ('AMBANI', 31),
  ('Pl butta', 32),
  ('Silver Jari', 33),
  ('PL TEMPLE.', 34),
  ('KM04::4card', 35),
  ('PL MEENA BKT', 36),
  ('SNVT.04.PARRET', 37),
  ('Rang Card ASR 07', 38),
  ('KM;04;PAITHANY', 39),
  ('EMBOSE BKT', 40),
  ('BUTTA', 41),
  ('Plain tissue', 42),
  ('J/WARP S/G', 43),
  ('BANDHANI', 44),
  ('Cantrast..EMBOJI BKT', 45),
  ('KUTTU', 46),
  ('PL CONTRAST 3k', 47),
  ('ASR09; 3cards', 48),
  ('PL SELF', 49),
  ('Silver gold EM', 50),
  ('Double Vadi Br', 51),
  ('Dhothi', 52),
  ('Ynkms 02', 53),
  ('Ynkms04', 54),
  ('ASRD NEW DESIGNS', 55),
  ('Ynkms03', 56),
  ('Temple', 57)
ON CONFLICT (name) DO NOTHING;
