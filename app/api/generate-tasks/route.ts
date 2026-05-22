import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import { adminAuth } from "@/lib/firebase-admin";
import { aiRateLimiter } from "@/lib/rate-limit";

const PREFERRED_FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5-8b:free",
  "meta-llama/llama-3.1-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/pixtral-12b:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

async function getCandidateModels(): Promise<string[]> {
  const candidates = [...PREFERRED_FREE_MODELS];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 1800 },
    });
    
    if (res.ok) {
      const data = await res.json();
      const availableFreeModels = new Set(
        data.data
          .filter((m: any) => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
          .map((m: any) => m.id)
      );

      // Add all currently available free models that aren't already in our preferred list
      data.data.forEach((m: any) => {
        if (m.pricing?.prompt === "0" && m.pricing?.completion === "0" && !candidates.includes(m.id)) {
          candidates.push(m.id);
        }
      });
      
      // Re-sort to prioritize our preferred ones that are actually available
      return candidates.filter(id => availableFreeModels.has(id));
    }
  } catch (error) {
    console.error("Error fetching free models from OpenRouter:", error);
  }
  return candidates;
}

function cleanJsonResponse(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "No valid response format found" };
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return { error: "Invalid response format" };
  }
}

async function tryGeminiFallback(messages: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // List of models to try in order of preference
  const geminiModels = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.0-pro"];
  
  for (const modelName of geminiModels) {
    try {
      console.log(`Attempting Gemini fallback with model: ${modelName}`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const chatHistory = messages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

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
      return cleanJsonResponse(text);
    } catch (err) {
      console.error(`Gemini fallback failed for ${modelName}:`, err);
      continue;
    }
  }
  return null;
}

export async function POST(req: Request) {
  // 1. Verify Authorization Token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized: Missing Authorization header" }, { status: 401 });
  }

  const token = authHeader.split("Bearer ")[1];
  let uid: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return Response.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }
    uid = decodedToken.uid;
  } catch (error) {
    console.error("Firebase Admin verification failed:", error);
    return Response.json({ error: "Unauthorized: Token verification failed" }, { status: 401 });
  }

  // 2. Rate Limiting — 10 requests per 60 seconds per user
  const rateCheck = aiRateLimiter.check(uid);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before generating more tasks." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
      }
    );
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;


  if (!openRouterKey && !geminiKey) {
    return Response.json({ error: "No API keys configured" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();

    // 1. Try OpenRouter if key is available
    if (openRouterKey) {
      const modelIds = await getCandidateModels();
      
      // Try up to 3 different models
      const modelsToTry = modelIds.slice(0, 3);
      
      for (const modelId of modelsToTry) {
        try {
          console.log(`Attempting OpenRouter with model: ${modelId}`);
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
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
              response_format: { type: "json_object" }
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content;
            return Response.json({ response: cleanJsonResponse(content) });
          }
          
          const errText = await response.text();
          console.warn(`OpenRouter model ${modelId} failed: ${response.status} ${errText}`);
        } catch (err) {
          console.error(`Error during OpenRouter call for ${modelId}:`, err);
        }
      }
    }

    // 2. Try Gemini Fallback
    if (geminiKey) {
      const result = await tryGeminiFallback(messages);
      if (result) {
        return Response.json({ response: result });
      }
    }

    throw new Error("All AI providers and models failed");

  } catch (error) {
    console.error("AI API Final Error:", error);
    return Response.json({ error: "Failed to generate response after multiple attempts" }, { status: 500 });
  }
}
