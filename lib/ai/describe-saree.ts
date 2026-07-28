import openai from "@/lib/openai";

export interface SareeDescription {
  dominant_colors: string[];
  pattern_type: string;
  border_design: string;
  fabric_texture: string;
  motifs: string[];
  overall_summary: string;
}

export async function describeSaree(imageUrl: string): Promise<SareeDescription> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a textile expert specializing in Indian sarees. Analyze the saree image and return a JSON object with these fields:
- dominant_colors: array of 2-4 main colors visible
- pattern_type: type of pattern (e.g., "floral", "geometric", "plain", "striped", "checked", "paisley", "temple", "abstract")
- border_design: description of the border/pallu design
- fabric_texture: observed texture (e.g., "silk", "cotton", "chiffon", "georgette", "banarasi")
- motifs: array of specific motifs or design elements visible
- overall_summary: a 1-2 sentence description capturing what makes this saree unique

Return ONLY valid JSON, no markdown or extra text.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this saree in detail for inventory matching purposes.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No description generated");

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as SareeDescription;
}

export async function describeSareeFromBase64(
  base64Data: string,
  mimeType: string
): Promise<SareeDescription> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return describeSaree(dataUrl);
}
