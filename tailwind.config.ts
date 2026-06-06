import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
