import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "@/lib/prompts";

const PREFERRED_FREE_MODELS = [
  "meta-llama/llama-3.1-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemini-flash-1.5-8b:free",
  "mistralai/pixtral-12b:free",
];

async function getFreeModel(): Promise<string> {
  try {
    // Next.js will cache this response for 30 minutes across all instances
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 1800 },
    });
    
    if (!res.ok) throw new Error("Failed to fetch models");
    const data = await res.json();
    
    const availableFreeModels = new Set(
      data.data
        .filter((m: any) => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
        .map((m: any) => m.id)
    );

    // Pick the first preferred model that is actually available
    for (const modelId of PREFERRED_FREE_MODELS) {
      if (availableFreeModels.has(modelId)) return modelId;
    }

    // Fallback to any free model if preferred ones aren't available
    const anyFreeModel = data.data.find((m: any) => m.pricing?.prompt === "0" && m.pricing?.completion === "0");
    if (anyFreeModel) return anyFreeModel.id;

  } catch (error) {
    console.error("Error fetching free models:", error);
  }

  return "meta-llama/llama-3.1-8b-instruct:free";
}

function cleanJsonResponse(text: string) {
  try {
    // Try to find JSON block in case model included markdown fences or filler text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "No valid response format found" };
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return { error: "Invalid response format" };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    const isGeminiOnly = process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY;

    if (isGeminiOnly) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      // gemini-1.0-pro is the most widely available fallback model
      const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

      // Gemini history must alternate User/Model and start with User
      const chatHistory = messages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      // Ensure history starts with 'user'
      while (chatHistory.length > 0 && chatHistory[0].role !== "user") {
        chatHistory.shift();
      }

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(SYSTEM_PROMPT + "\n\nUser: " + lastMessage.content);
      const text = result.response.text();
      return Response.json({ response: cleanJsonResponse(text) });
    }

    const modelId = await getFreeModel();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dangdoro.app",
        "X-Title": "Dangdoro",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 4096,
        temperature: 0.7,
        response_format: { type: "json_object" } // Tell OpenRouter we want JSON if supported
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return Response.json({ response: cleanJsonResponse(content) });

  } catch (error) {
    console.error("AI API error:", error);
    return Response.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
