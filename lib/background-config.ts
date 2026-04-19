// Background palette configurations
export const BG_PALETTES = {
    mixed: {
        name: "Productive Flow",
        orbs: [
            { x: 0.15, y: 0.3, r: 420, color: "10,185,129" },
            { x: 0.78, y: 0.5, r: 340, color: "99,102,241" },
            { x: 0.45, y: 0.8, r: 280, color: "56,189,248" },
            { x: 0.9, y: 0.12, r: 220, color: "168,85,247" },
        ]
    },
    emerald: {
        name: "Focus Sessions",
        orbs: [
            { x: 0.15, y: 0.3, r: 420, color: "16,185,129" },
            { x: 0.78, y: 0.5, r: 340, color: "20,184,166" },
            { x: 0.45, y: 0.8, r: 280, color: "34,197,94" },
            { x: 0.9, y: 0.12, r: 220, color: "6,182,212" },
        ]
    },
    dual: {
        name: "Emerald + Purple",
        orbs: [
            { x: 0.2, y: 0.3, r: 400, color: "16,185,129" },
            { x: 0.8, y: 0.6, r: 380, color: "139,92,246" },
            { x: 0.5, y: 0.8, r: 300, color: "20,184,166" },
        ]
    },
    cool: {
        name: "Cool Mono",
        orbs: [
            { x: 0.15, y: 0.3, r: 420, color: "56,189,248" },
            { x: 0.78, y: 0.5, r: 340, color: "99,102,241" },
            { x: 0.45, y: 0.8, r: 280, color: "14,165,233" },
        ]
    },
    warm: {
        name: "Warm Sunset",
        orbs: [
            { x: 0.15, y: 0.3, r: 420, color: "251,146,60" },
            { x: 0.78, y: 0.5, r: 340, color: "244,63,94" },
            { x: 0.45, y: 0.8, r: 280, color: "245,158,11" },
            { x: 0.9, y: 0.12, r: 220, color: "236,72,153" },
        ]
    },
    none: {
        name: "None",
        orbs: []
    }
} as const;

export const BG_CONFIG = {
    STORAGE_KEYS: {
        SHOW_DOTS: "dangdoro-show-dots",
        BG_PALETTE: "dangdoro-bg-palette",
        SHOW_DOTS_GLOBAL: "dangdoro-show-dots-global",
        BG_PALETTE_GLOBAL: "dangdoro-bg-palette-global",
    },
    DEFAULTS: {
        showDots: true,
        palette: "mixed" as keyof typeof BG_PALETTES,
    }
} as const;
