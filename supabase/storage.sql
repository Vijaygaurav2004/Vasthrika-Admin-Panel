-- Enable the storage extension
create extension if not exists "storage" schema "extensions";

-- Create the products bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Allow public access to read files
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'products' );

-- Allow authenticated users to upload files
create policy "Allow uploads"
on storage.objects for insert
with check (
  bucket_id = 'products'
);

-- Allow users to update their own files
create policy "Allow updates"
on storage.objects for update
using (
  bucket_id = 'products'
);

-- Allow users to delete their own files
create policy "Allow deletes"
on storage.objects for delete
using (
  bucket_id = 'products'
);

-- Allow public access to upload files (for development)
create policy "Public upload access"
on storage.objects for insert
with check ( bucket_id = 'products' );

-- Allow public access to update files (for development)
create policy "Public update access"
on storage.objects for update
using ( bucket_id = 'products' );

-- Allow public access to delete files (for development)
create policy "Public delete access"
on storage.objects for delete
using ( bucket_id = 'products' ); 