import type { Config } from "tailwindcss";

/**
 * Phantom design tokens. Strict 4/8/12/16/24/32/48/64/96/128/192 spacing scale.
 * Accent colors are sparing on purpose — see globals.css for usage rules.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Replace Tailwind's default spacing with the on-grid scale we use.
    spacing: {
      0: "0",
      px: "1px",
      0.5: "2px",
      1: "4px",
      2: "8px",
      3: "12px",
      4: "16px",
      6: "24px",
      8: "32px",
      12: "48px",
      16: "64px",
      24: "96px",
      32: "128px",
      48: "192px",
      64: "256px",
      96: "384px",
    },
    extend: {
      colors: {
        // Surfaces
        void: "#050507",
        ink: "#0A0A0B",
        graphite: "#14141A",
        smoke: "#1F1F28",
        // Text
        bone: "#F5F5F0",
        fog: "#A8A8B3",
        mist: "#6B6B78",
        // Accents — use sparingly
        electric: "#00F0FF",
        plasma: "#7B61FF",
        ember: "#FF6B35",
        // Functional
        success: "#00D97E",
        error: "#FF4757",
      },
      fontFamily: {
        display: [
          "Clash Display",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        body: [
          "Satoshi",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        // Slightly oversized scale — editorial-tech aesthetic
        "2xs": ["10px", { lineHeight: "1.5" }],
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.6" }],
        lg: ["18px", { lineHeight: "1.55" }],
        xl: ["20px", { lineHeight: "1.5" }],
        "2xl": ["24px", { lineHeight: "1.35" }],
        "3xl": ["32px", { lineHeight: "1.2" }],
        "4xl": ["40px", { lineHeight: "1.15" }],
        "5xl": ["56px", { lineHeight: "1.05" }],
        "6xl": ["72px", { lineHeight: "1" }],
        "7xl": ["96px", { lineHeight: "0.95" }],
        "8xl": ["128px", { lineHeight: "0.95" }],
        "9xl": ["160px", { lineHeight: "0.92" }],
      },
      letterSpacing: {
        tightest: "-0.06em",
        tighter: "-0.04em",
        tight: "-0.02em",
        normal: "0",
        wide: "0.02em",
        widest: "0.2em",
        kicker: "0.32em",
      },
      transitionTimingFunction: {
        // The "luxurious" out-expo
        luxe: "cubic-bezier(0.16, 1, 0.3, 1)",
        snap: "cubic-bezier(0.5, 0, 0.1, 1)",
      },
      transitionDuration: {
        250: "250ms",
        400: "400ms",
        600: "600ms",
        900: "900ms",
        1200: "1200ms",
      },
      animation: {
        "pulse-glow": "pulseGlow 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "marquee-l": "marquee 40s linear infinite",
        "marquee-r": "marqueeReverse 40s linear infinite",
        "shimmer-edge": "shimmerEdge 3s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 16px 0 rgba(0,240,255,0.4)" },
          "50%": { opacity: "0.6", boxShadow: "0 0 32px 4px rgba(0,240,255,0.7)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeReverse: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmerEdge: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
