import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#ececef",
          200: "#d4d4dc",
          300: "#a8a8b6",
          400: "#7c7c8e",
          500: "#54546a",
          600: "#3a3a4d",
          700: "#272736",
          800: "#181824",
          900: "#0c0c14",
        },
        accent: {
          400: "#7dd3fc",
          500: "#38bdf8",
          600: "#0ea5e9",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
