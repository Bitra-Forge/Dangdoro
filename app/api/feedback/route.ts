import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables.");
      return Response.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { message, category } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    if (!category || typeof category !== "string") {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    // Try to resolve user info if Authorization header is present
    let userDetails = {
      status: "Guest",
      displayName: "Guest",
      email: "N/A",
      uid: "N/A",
    };

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (decodedToken) {
          let displayName = decodedToken.name || decodedToken.displayName || "N/A";
          
          try {
            const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData?.displayName) {
                displayName = userData.displayName;
              }
            }
          } catch (dbErr) {
            console.warn("Failed to fetch displayName from Firestore in feedback route:", dbErr);
          }

          userDetails = {
            status: decodedToken.firebase?.sign_in_provider === "anonymous" ? "Anonymous User" : "Authenticated User",
            displayName,
            email: decodedToken.email || "N/A",
            uid: decodedToken.uid,
          };
        }
      } catch (err) {
        console.warn("Failed to verify ID token in feedback route:", err);
        // We continue anyway, treating it as Guest
      }
    }

    // Format the HTML message for Telegram (escaping HTML special chars to prevent syntax errors in parse_mode: HTML)
    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const formattedMessage = [
      `📩 <b>New Feedback Received!</b>`,
      ``,
      `📌 <b>Category:</b> ${escapeHtml(category)}`,
      `💬 <b>Message:</b>`,
      `<code>${escapeHtml(message.trim())}</code>`,
      ``,
      `👤 <b>User Info:</b>`,
      `- <b>Name/Username:</b> ${escapeHtml(userDetails.displayName)}`,
      `- <b>Status:</b> ${escapeHtml(userDetails.status)}`,
      `- <b>Email:</b> ${escapeHtml(userDetails.email)}`,
      `- <b>User ID:</b> <code>${escapeHtml(userDetails.uid)}</code>`,
      `- <b>Date/Time:</b> ${new Date().toLocaleString()}`,
    ].join("\n");

    // Send the message to Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formattedMessage,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram API error: ${response.status} ${errorText}`);
      return Response.json(
        { error: "Failed to send message to Telegram" },
        { status: 502 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return Response.json(
      { error: "An unexpected error occurred while sending feedback" },
      { status: 500 }
    );
  }
}
