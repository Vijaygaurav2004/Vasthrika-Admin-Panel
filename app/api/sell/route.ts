import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

// GET /api/sell?code=VS-000001  -> look up a saree by its QR code
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("stock_items")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "not_found", code }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("Error in sell lookup:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}

// POST /api/sell  { code, buyer_name?, buyer_phone? }  -> mark that saree sold
export async function POST(request: NextRequest) {
  try {
    const { code, buyer_name, buyer_phone } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const { data: existing, error: findError } = await supabase
      .from("stock_items")
      .select("*")
      .eq("code", code.trim())
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "not_found", code }, { status: 404 });
    }
    if (existing.status === "sold") {
      return NextResponse.json(
        { error: "already_sold", item: existing },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("stock_items")
      .update({
        status: "sold",
        sold_at: now,
        updated_at: now,
        buyer_name: buyer_name?.trim() || null,
        buyer_phone: buyer_phone?.trim() || null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to mark sold" }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Error marking sold:", error);
    return NextResponse.json({ error: "Failed to mark sold" }, { status: 500 });
  }
}
