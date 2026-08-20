import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { describeSareeFromBase64 } from "@/lib/ai/describe-saree";
import { isR2Configured, isR2Url, uploadToR2, deleteFromR2 } from "@/lib/r2";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const label = formData.get("label") as string | null;
    const category = formData.get("category") as string | null;
    const code = (formData.get("code") as string | null)?.trim() || null;
    const color = (formData.get("color") as string | null)?.trim() || null;
    const pattern = (formData.get("pattern") as string | null)?.trim() || null;
    const fabric = (formData.get("fabric") as string | null)?.trim() || null;
    const priceRaw = (formData.get("price") as string | null)?.trim();
    const price = priceRaw ? Number(priceRaw) : null;
    const actor = (formData.get("actor") as string | null)?.trim() || null;

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (code && files.length > 1) {
      return NextResponse.json(
        { error: "A QR code identifies one saree — attach only one photo when using a code." },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    if (code) {
      const { data: dup } = await supabase
        .from("stock_items")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { error: `Code ${code} is already used by another saree.` },
          { status: 409 }
        );
      }
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `stock/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Store the photo in Cloudflare R2 when configured, else Supabase storage.
        let publicUrl: string;
        if (isR2Configured()) {
          try {
            publicUrl = await uploadToR2(fileName, Buffer.from(arrayBuffer), file.type || "image/jpeg");
          } catch (r2Err) {
            errors.push(`R2 upload failed for ${file.name}: ${r2Err instanceof Error ? r2Err.message : String(r2Err)}`);
            continue;
          }
        } else {
          const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(fileName, arrayBuffer, {
              contentType: file.type,
              cacheControl: "3600",
            });

          if (uploadError) {
            errors.push(`Upload failed for ${file.name}: ${uploadError.message}`);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("products")
            .getPublicUrl(fileName);

          if (!urlData?.publicUrl) {
            errors.push(`Failed to get URL for ${file.name}`);
            continue;
          }
          publicUrl = urlData.publicUrl;
        }

        let aiDescription = null;
        try {
          const desc = await describeSareeFromBase64(base64, file.type || "image/jpeg");
          aiDescription = JSON.stringify(desc);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("AI description failed (non-blocking):", errMsg);
        }

        const { data: item, error: insertError } = await supabase
          .from("stock_items")
          .insert({
            image: publicUrl,
            code: code || null,
            label: label || null,
            category: category || null,
            color: color || null,
            pattern: pattern || null,
            fabric: fabric || null,
            price: price != null && !Number.isNaN(price) ? price : null,
            ai_description: aiDescription,
            status: "in_stock",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          errors.push(`DB insert failed: ${insertError.message || insertError.code}`);
          console.error("Insert error:", JSON.stringify(insertError, null, 2));
          continue;
        }

        // Best-effort: record who added it. Ignored if the column isn't there yet.
        if (actor && item?.id) {
          await supabase.from("stock_items").update({ created_by: actor }).eq("id", item.id);
        }

        results.push(item);
      } catch (err) {
        errors.push(`Failed for ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors.join("; "), errors }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      added: results.length,
      items: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in inventory route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, imageUrl } = await request.json();
    if (!id || !supabase) {
      return NextResponse.json({ error: "Missing ID or DB" }, { status: 400 });
    }

    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) throw error;

    if (imageUrl) {
      try {
        if (isR2Configured() && isR2Url(imageUrl)) {
          await deleteFromR2(imageUrl);
        } else {
          const parts = imageUrl.split("/products/");
          const filePath = parts[parts.length - 1];
          if (filePath) {
            await supabase.storage.from("products").remove([filePath]);
          }
        }
      } catch (fileErr) {
        // Row is already deleted; a leftover file is non-fatal.
        console.error("Image cleanup failed (non-blocking):", fileErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stock item:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
