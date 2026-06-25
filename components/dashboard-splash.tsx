"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import bgImage from "@/components/ui/4.jpg";

/* ─── constants ─────────────────────────────────────────────────────────── */
export const DASHBOARD_PIN_KEY = "dangdoro-dashboard-pin";
export const DASHBOARD_SESSION_KEY = "dangdoro-admin-splash-passed";
const DEFAULT_PIN = "1234";
const PIN_LENGTH = 4;
const ZOOM_MS = 900; // landing → pin transition
const LOAD_MS = 1350; // fake loading duration
const FADE_OUT_MS = 700; // overlay fade-out

/* ─── helpers ───────────────────────────────────────────────────────────── */
function getStoredPin(): string {
  if (typeof window === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(DASHBOARD_PIN_KEY) || DEFAULT_PIN;
}

type Phase = "landing" | "zooming" | "pin" | "loading";

/* ─── component ─────────────────────────────────────────────────────────── */
export function DashboardSplashOverlay() {
  /* visibility */
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  /* flow */
  const [phase, setPhase] = useState<Phase>("landing");

  /* pin entry */
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [shaking, setShaking] = useState(false);

  /* refs */
  const inputRef = useRef<HTMLInputElement>(null);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  function addTimer(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timerIds.current.push(id);
  }

  /* cleanup */
  useEffect(
    () => () => {
      timerIds.current.forEach(clearTimeout);
    },
    [],
  );

  /* skip if already unlocked this session */
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(DASHBOARD_SESSION_KEY) === "1"
    ) {
      setVisible(false);
    }
  }, []);

  /* auto-focus the hidden PIN input */
  useEffect(() => {
    if (phase === "pin") {
      addTimer(() => inputRef.current?.focus(), 160);
    }
  }, [phase]);

  /* ── handlers ── */
  function handleArrow() {
    setPhase("zooming");
    addTimer(() => setPhase("pin"), ZOOM_MS);
  }

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (pinError) return; // block input while shaking
    const newVal = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPinValue(newVal);
    if (newVal.length === PIN_LENGTH) {
      addTimer(() => verifyPin(newVal), 30);
    }
  }

  function verifyPin(entered: string) {
    if (entered === getStoredPin()) {
      /* correct → show loader then fade out */
      setPhase("loading");
      addTimer(() => {
        setFadingOut(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(DASHBOARD_SESSION_KEY, "1");
        }
        addTimer(() => {
          // Signal to the admin page that the overlay is fully gone
          window.dispatchEvent(new CustomEvent("dangdoro-admin-unlocked"));
          setVisible(false);
        }, FADE_OUT_MS);
      }, LOAD_MS);
    } else {
      /* wrong → shake + reset */
      setPinError(true);
      setShaking(true);
      addTimer(() => {
        setShaking(false);
        setPinError(false);
        setPinValue("");
        inputRef.current?.focus();
      }, 700);
    }
  }

  function handleCancel() {
    setPinValue("");
    setPinError(false);
    setPhase("landing");
  }

  /* ── derived ── */
  if (!visible) return null;

  const isBlurred = phase !== "landing";
  const digits = Array.from(
    { length: PIN_LENGTH },
    (_, i) => pinValue[i] ?? "",
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] overflow-hidden",
        fadingOut
          ? "opacity-0 transition-opacity duration-700 pointer-events-none"
          : "opacity-100",
      )}
    >
      {/* ── background image (zooms + blurs on proceed) ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: isBlurred ? "scale(1.12)" : "scale(1)",
          filter: isBlurred
            ? "blur(18px) brightness(0.78)"
            : "blur(0px)  brightness(1)",
          transition: `
            transform ${ZOOM_MS}ms cubic-bezier(0.4,0,0.2,1),
            filter    ${ZOOM_MS}ms cubic-bezier(0.4,0,0.2,1)
          `,
          willChange: "transform, filter",
        }}
      >
        <Image
          src={bgImage}
          alt="Splash Background"
          fill
          priority
          placeholder="blur"
          className="object-cover pointer-events-none"
        />
      </div>

      {/* subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* dynamic dark overlay – deepens when blurred */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          backgroundColor: "rgba(0,0,0,0.32)",
          opacity: isBlurred ? 1 : 0.5,
        }}
      />

      {/* ════════════════ LANDING ════════════════ */}
      {phase === "landing" && (
        <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-500">
          <button
            onClick={handleArrow}
            aria-label="Enter dashboard"
            className={cn(
              "relative flex items-center justify-center",
              "w-[68px] h-[68px] rounded-full",
              "bg-white/10 backdrop-blur-2xl",
              "border border-white/30",
              "shadow-[0_8px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.18)]",
              "hover:bg-white/20 hover:border-white/50 hover:scale-110",
              "active:scale-95 transition-all duration-300 cursor-pointer",
            )}
          >
            {/* outer pulsing ring */}
            <span
              className="absolute inset-[-7px] rounded-full border border-white/18 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <ChevronRight className="w-7 h-7 text-white relative z-10 ml-0.5 drop-shadow-sm" />
          </button>
        </div>
      )}

      {/* ════════════════ PIN ENTRY ════════════════ */}
      {phase === "pin" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 animate-in fade-in duration-500">
          {/* real input – invisible, only captures keystrokes */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={PIN_LENGTH}
            value={pinValue}
            onChange={handlePinChange}
            className="sr-only"
            autoComplete="off"
            aria-label="Enter 4-digit PIN"
          />

          {/* four visual boxes */}
          <div
            className={cn(
              "flex items-center gap-3.5 cursor-text",
              shaking && "animate-shake",
            )}
            onClick={() => inputRef.current?.focus()}
          >
            {digits.map((d, i) => (
              <div key={i} className="relative w-[70px] h-[82px]">
                {/* box */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-[18px] border transition-all duration-200",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.18)]",
                    pinError
                      ? "border-red-400/50 bg-red-500/10"
                      : d
                        ? "border-white/35 bg-white/[0.14]"
                        : "border-white/[0.18] bg-white/[0.07]",
                  )}
                />
                {/* dot when filled */}
                {d && !pinError && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[10px] h-[10px] rounded-full bg-white/80" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* label row */}
          <div className="flex items-center gap-[10px]">
            <span
              className={cn(
                "text-[13px] font-medium tracking-[0.015em] select-none transition-colors duration-300",
                pinError ? "text-red-300" : "text-white/50",
              )}
            >
              {pinError ? "Incorrect PIN" : "Enter PIN"}
            </span>
            <button
              onClick={handleCancel}
              className="text-[13px] font-medium text-white/35 hover:text-white/65 transition-colors duration-200 select-none"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ════════════════ LOADING ════════════════ */}
      {phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-500">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/75 animate-spin" />
        </div>
      )}
    </div>
  );
}
