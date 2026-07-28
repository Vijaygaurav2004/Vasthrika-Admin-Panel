import { NextRequest, NextResponse } from "next/server";
import { matchGroupPhoto } from "@/lib/ai/match-sarees";
import { supabase } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const { data: stockItems, error } = await supabase
      .from("stock_items")
      .select("*")
      .eq("status", "in_stock")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
    }

    if (!stockItems || stockItems.length === 0) {
      return NextResponse.json({
        total_sarees_detected: 0,
        matches: [],
        unmatched_count: 0,
        message: "No items in inventory. Add sarees in the Inventory section first.",
      });
    }

    const result = await matchGroupPhoto(base64, mimeType, stockItems);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in stock-out:", error);
    return NextResponse.json({ error: "Failed to process group photo" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { itemIds } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "No item IDs provided" }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("stock_items")
      .update({ status: "sold", sold_at: now, updated_at: now })
      .in("id", itemIds);

    if (error) {
      return NextResponse.json({ error: "Failed to update items" }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: itemIds.length });
  } catch (error) {
    console.error("Error marking as sold:", error);
    return NextResponse.json({ error: "Failed to mark items as sold" }, { status: 500 });
  }
}
