import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a task planning assistant for a productivity app called Dangdoro. The user will describe what they need to accomplish. Your job is to break it down into organized task groups with individual tasks.

Rules:
- Create logical groupings (e.g., "Website Redesign", "Study Plan", "Errands")
- Assign realistic priorities: "urgent", "high", "normal", or "natural"
- Assign realistic duration in minutes (15–120 range typically)
- Add helpful notes when context suggests extra detail
- Keep task titles concise (under 60 characters)
- Create 1–4 groups with 2–8 tasks each
- If the request is vague, make reasonable assumptions

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanation. The JSON must match this exact schema:

{
  "groups": [
    {
      "name": "string (group name)",
      "color": "zinc" | "emerald" | "sky" | "violet" | "rose" | "amber" | "cyan",
      "tasks": [
        {
          "title": "string",
          "priority": "urgent" | "high" | "normal" | "natural",
          "durationMinutes": number | null,
          "notes": "string"
        }
      ]
    }
  ]
}

If the user's message is a greeting or unrelated to task planning, respond with a friendly message in this format:
{"message": "your friendly response here"}
`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env.local" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();

    const isGemini = process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY;

    if (isGemini) {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const chatHistory = messages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      // Gemini requires history to start with 'user' role
      while (chatHistory.length > 0 && chatHistory[0].role === "model") {
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
      return Response.json({ response: result.response.text() });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dangdoro.app",
        "X-Title": "Dangdoro",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return Response.json({ response: data.choices[0].message.content });
  } catch (error) {
    console.error("AI API error:", error);
    return Response.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
