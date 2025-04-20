import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Storage service not available' },
        { status: 503 }
      );
    }

    // Check if bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('Bucket error:', bucketError);
      return NextResponse.json(
        { error: 'Failed to access storage' },
        { status: 500 }
      );
    }

    const productsBucket = buckets.find(b => b.name === 'products');
    if (!productsBucket) {
      return NextResponse.json(
        { error: 'Products bucket not found' },
        { status: 500 }
      );
    }

    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `products/${fileName}`;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
      });
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }
    
    // Get public URL
    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);
    
    if (!data?.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error('Error in upload route:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
} 