import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08090b",
        panel: "#111316",
        line: "#24282d",
        forge: "#f47b20",
        "forge-soft": "#ff9a52",
        mist: "#a4a9b1"
      },
      boxShadow: {
        glow: "0 0 60px rgba(244, 123, 32, .18)"
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        orbit: "orbit 14s linear infinite",
        marquee: "marquee 28s linear infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(-4deg)" },
          "50%": { transform: "translateY(-14px) rotate(2deg)" }
        },
        orbit: {
          from: { transform: "rotate(0deg) translateX(72px) rotate(0deg)" },
          to: { transform: "rotate(360deg) translateX(72px) rotate(-360deg)" }
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
