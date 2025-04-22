-- Step 1: Enable RLS
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Create Bucket Management Policies
CREATE POLICY "Enable all bucket actions for authenticated users"
ON storage.buckets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 3: Create Object Management Policies

-- Allow public read access
CREATE POLICY "Public Read Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'products');

-- Allow all uploads to products bucket
CREATE POLICY "Allow all uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'products');

-- Allow all updates to products bucket
CREATE POLICY "Allow all updates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'products');

-- Allow all deletes from products bucket
CREATE POLICY "Allow all deletes"
ON storage.objects
FOR DELETE
USING (bucket_id = 'products');

-- Step 4: Create the products bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Drop any conflicting policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects; 