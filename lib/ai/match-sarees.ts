import openai from "@/lib/openai";
import { StockItem } from "@/types/stock-item";

export interface MatchResult {
  item_id: string;
  label: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  thumbnail: string;
}

export interface MatchResponse {
  total_sarees_detected: number;
  matches: MatchResult[];
  unmatched_count: number;
}

export async function matchGroupPhoto(
  groupPhotoBase64: string,
  mimeType: string,
  stockItems: StockItem[]
): Promise<MatchResponse> {
  const activeItems = stockItems.filter((i) => i.status === "in_stock");

  if (activeItems.length === 0) {
    return { total_sarees_detected: 0, matches: [], unmatched_count: 0 };
  }

  const inventoryList = activeItems.map((item) => ({
    id: item.id,
    label: item.label || "Unnamed saree",
    ai_description: item.ai_description || "No description available",
    category: item.category,
  }));

  const imageUrls = activeItems
    .filter((item) => item.image)
    .map((item) => ({
      type: "image_url" as const,
      image_url: { url: item.image, detail: "low" as const },
    }));

  const dataUrl = `data:${mimeType};base64,${groupPhotoBase64}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a textile expert specializing in Indian sarees. You will be shown a group photo containing multiple sarees, along with individual saree inventory photos and their descriptions.

Your task:
1. Count how many individual sarees are visible in the group photo
2. For each saree visible, try to match it against the inventory items by comparing visual features: colors, patterns, motifs, border designs, and fabric type
3. Rate each match confidence as "high", "medium", or "low"

Return a JSON object with:
- total_sarees_detected: number of individual sarees visible in the group photo
- matches: array of objects with { item_id, label, confidence, reasoning }
  - item_id: the id from the inventory list
  - label: the label from the inventory list
  - confidence: "high" | "medium" | "low"
  - reasoning: brief explanation of why this match was made
- unmatched_count: number of sarees in the photo that could not be matched

Important rules:
- Only match if you are reasonably confident. Do not force matches.
- An item can only be matched once.
- If a saree in the photo does not match any inventory item, count it as unmatched.

Return ONLY valid JSON, no markdown or extra text.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the inventory of sarees in stock:\n\n${JSON.stringify(inventoryList, null, 2)}\n\nBelow are the individual inventory photos followed by the group photo. The LAST image is the group photo to match against. All images before it are individual inventory items in the same order as the list above.\n\nAnalyze and find matches:`,
          },
          ...imageUrls,
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No match results generated");

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const result = JSON.parse(cleaned) as MatchResponse;

  result.matches = result.matches.map((match) => {
    const item = activeItems.find((i) => i.id === match.item_id);
    return { ...match, thumbnail: item?.image || "" };
  });

  return result;
}
