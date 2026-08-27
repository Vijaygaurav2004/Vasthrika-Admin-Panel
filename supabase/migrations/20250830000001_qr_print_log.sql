-- Run this in the Supabase SQL Editor.
-- Records every QR label print batch (prefix, number range, count, who, when).
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
