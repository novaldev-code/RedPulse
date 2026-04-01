/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./apps/web/index.html",
    "./apps/web/src/**/*.{ts,tsx}",
    "./packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        }
      },
      boxShadow: {
        "pulse-sm": "0 0 18px rgba(255, 0, 0, 0.18)",
        "pulse-md": "0 0 28px rgba(255, 0, 0, 0.24)",
        "pulse-lg": "0 0 42px rgba(255, 0, 0, 0.32)"
      },
      backgroundImage: {
        "redpulse-grid":
          "radial-gradient(circle at top, rgba(255,0,0,0.16), transparent 36%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
      },
      backgroundSize: {
        grid: "100% 100%, 28px 28px, 28px 28px"
      },
      transitionTimingFunction: {
        "pulse-out": "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};
