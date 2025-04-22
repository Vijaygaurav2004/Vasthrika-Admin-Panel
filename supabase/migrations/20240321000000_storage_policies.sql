-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes" ON storage.objects;

-- Create the products bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Enable RLS on storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create bucket management policies
CREATE POLICY "Allow bucket management" ON storage.buckets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'products');

-- Allow public uploads to products bucket
CREATE POLICY "Allow uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'products'
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow public updates to products bucket
CREATE POLICY "Allow updates"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'products'
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow public deletes from products bucket
CREATE POLICY "Allow deletes"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'products'
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
); 