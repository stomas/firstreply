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
        // Single strong accent — a trustworthy, calm teal-green.
        brand: {
          50: "#eefdf6",
          100: "#d5f9e8",
          200: "#aef1d4",
          300: "#77e3ba",
          400: "#3fce9c",
          500: "#16a97c",
          600: "#0d8a66",
          700: "#0c6e53",
          800: "#0d5744",
          900: "#0c4839",
          950: "#04291f",
        },
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)",
        "card-hover":
          "0 2px 4px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.10)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
