/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0D0D0F",
        charcoal: "#111113",
        iron: "#161618",
        crimson: {
          DEFAULT: "#B91C1C",
          bright: "#DC2626",
        },
        ochre: {
          DEFAULT: "#D97706",
          bright: "#F59E0B",
        },
        emerald: {
          DEFAULT: "#10B981",
        },
        cream: "#F5F2EB",
        parchment: "#D6CFC2",
        muted: "#8B8680",
        broadcast: "#090D16",
      },
      fontFamily: {
        display: ['"Oswald"', '"Impact"', '"Arial Narrow"', "sans-serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
