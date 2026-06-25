import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Dangdoro - Focus. Compete. Win. — Collaborative Pomodoro & Real-time Leaderboard";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const montserratBold = await fetch(
    new URL("./fonts/Montserrat-Bold.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          padding: "80px",
          position: "relative",
          fontFamily: "Montserrat",
        }}
      >
        {/* Subtle background glow mapping to core workspace colors */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle at 75% 50%, #ef444415 0%, transparent 60%), radial-gradient(circle at 25% 50%, #0ea5e910 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Left Side: Branding, Slogan and Mode Badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "24px",
            maxWidth: "50%",
          }}
        >
          {/* Core Feature Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#ef444415",
              border: "1px solid #ef444430",
              padding: "6px 16px",
              borderRadius: "9999px",
            }}
          >
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
            <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 900, letterSpacing: "0.15em" }}>
              POMODORO ENGINE
            </span>
          </div>

          {/* Website Name */}
          <h1
            style={{
              fontSize: "72px",
              fontWeight: 900,
              color: "white",
              margin: 0,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            Dangdoro
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: "20px",
              color: "#a1a1aa",
              margin: 0,
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            Real-time collaborative focus timer, synchronized group sessions, and community leaderboards.
          </p>

          {/* Feature Badges */}
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#C9B037",
                backgroundColor: "#C9B03710",
                border: "1px solid #C9B03725",
                padding: "6px 12px",
                borderRadius: "8px",
              }}
            >
              Leaderboards
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#0ea5e9",
                backgroundColor: "#0ea5e910",
                border: "1px solid #0ea5e925",
                padding: "6px 12px",
                borderRadius: "8px",
              }}
            >
              Timer Sync
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#10b981",
                backgroundColor: "#10b98110",
                border: "1px solid #10b98125",
                padding: "6px 12px",
                borderRadius: "8px",
              }}
            >
              Ambient Audio
            </span>
          </div>
        </div>

        {/* Right Side: Mock Web Application Interface */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            width: "420px",
            position: "relative",
          }}
        >
          {/* Main Glassmorphic Timer Card resembling the app UI */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: "rgba(20, 20, 25, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "24px",
              padding: "32px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Active Mode selector */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  backgroundColor: "#ef444420",
                  color: "#ef4444",
                  border: "1px solid #ef444440",
                }}
              >
                pomodoro
              </span>
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 12px", borderRadius: "9999px", color: "rgba(255, 255, 255, 0.4)" }}>
                short break
              </span>
            </div>

            {/* Time Left representation */}
            <span
              style={{
                fontSize: "72px",
                fontWeight: 900,
                color: "white",
                lineHeight: 1,
                marginBottom: "24px",
                letterSpacing: "-0.02em",
              }}
            >
              25:00
            </span>

            {/* Progress representation */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <div style={{ flex: 1, height: "4px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "9999px", display: "flex" }}>
                <div style={{ width: "35%", height: "100%", backgroundColor: "#ef4444", borderRadius: "9999px" }} />
              </div>
              <span style={{ fontSize: "11px", fontWeight: 900, color: "rgba(255, 255, 255, 0.6)" }}>35%</span>
            </div>
          </div>

          {/* Active Synced Presence indicators */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(20, 20, 25, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "16px",
              padding: "12px 20px",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#a1a1aa" }}>
                SYNCED WORKSPACE
              </span>
            </div>

            {/* Overlapping team member avatars */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {["ME", "TA", "HF"].map((name, i) => (
                <div
                  key={i}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: i === 0 ? "#ef4444" : i === 1 ? "#0ea5e9" : "#C9B037",
                    border: "2px solid #09090b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9px",
                    fontWeight: 900,
                    color: "white",
                    marginLeft: i > 0 ? "-8px" : 0,
                  }}
                >
                  {name}
                </div>
              ))}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "#27272a",
                  border: "2px solid #09090b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  fontWeight: 900,
                  color: "#a1a1aa",
                  marginLeft: "-8px",
                }}
              >
                +5
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Montserrat",
          data: montserratBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
