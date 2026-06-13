import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos del design system. Centralizan los roles de color
        // (antes dispersos como amber-500/600, red-500/600, slate-*). Los
        // componentes base (Button/Card/Modal) los consumen.
        primary: {
          DEFAULT: "#f59e0b", // amber-500
          hover: "#fbbf24", // amber-400
          foreground: "#020617", // slate-950 (texto sobre primario)
        },
        danger: {
          DEFAULT: "#dc2626", // red-600
          hover: "#ef4444", // red-500
          foreground: "#f8fafc", // slate-50
        },
        surface: {
          DEFAULT: "#0f172a", // slate-900
          muted: "#020617", // slate-950
        },
        line: {
          DEFAULT: "#1e293b", // slate-800
          strong: "#334155", // slate-700
        },
      },
      keyframes: {
        // Subtle horizontal slide used by the phase-questions wizard.
        // direction = "next" → content slides in from the right.
        "wizard-next": {
          "0%": { transform: "translateX(24px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // direction = "prev" → content slides in from the left.
        "wizard-prev": {
          "0%": { transform: "translateX(-24px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "wizard-next": "wizard-next 220ms ease-out both",
        "wizard-prev": "wizard-prev 220ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
