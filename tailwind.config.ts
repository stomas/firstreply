import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Single strong accent — a calm, trustworthy green.
        brand: {
          DEFAULT: "#0F8F6A",
          hover: "#0B7457",
          tint: "#E8F7F1", // accent-light background
          tintborder: "#BCE8D8", // accent-light border
          reply: "#F6FBF9", // reply / positive surface
          replyborder: "#E4F2EC",
        },
        ink: {
          DEFAULT: "#10201B",
          soft: "#51635D",
          muted: "#7A8A85",
        },
        line: {
          DEFAULT: "#DDE7E3",
          soft: "#F1F5F3",
          faint: "#EDF2F0",
        },
        page: "#F8FAF9",
        tint2: "#FBFDFC",
        warn: {
          text: "#8A5A00",
          bg: "#FFF7E6",
          bg2: "#FFFBF2",
          border: "#F3D08A",
          border2: "#F3E4C4",
        },
        danger: {
          text: "#9F1239",
          bg: "#FFF1F2",
          border: "#FECDD3",
        },
        footer: {
          bg: "#10201B",
          text: "#B9C9C2",
          soft: "#8FA69D",
          faint: "#6E837B",
          line: "#1E332B",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-manrope)",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 4px 18px -12px rgba(16,32,27,0.18)",
        cardsoft: "0 3px 14px -10px rgba(16,32,27,0.16)",
        lift: "0 20px 55px -30px rgba(16,32,27,0.32)",
        hero: "0 24px 60px -28px rgba(16,32,27,0.35)",
        pricing: "0 20px 50px -26px rgba(15,143,106,0.4)",
        cta: "0 6px 18px rgba(15,143,106,0.25)",
      },
      maxWidth: {
        content: "1200px",
      },
      keyframes: {
        frFade: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
