import type { Config } from "tailwindcss";

// Палитра — PRD §12.3. Material 3 как база, Dynamic Color отключён.
// Светлая база — тёплый off-white, тёмная — тёплый тёмный.
// Акценты ограничены тремя приглушёнными оттенками; фиолетовый и неон запрещены.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#F6F3ED", // тёплый off-white, light surface
          ink: "#1A1916",     // тёплый тёмный, dark surface
        },
        ink: {
          DEFAULT: "#1A1916",
          muted: "#5C584F",   // приглушённый текст
          faint: "#8A8578",   // подписи, captions
        },
        rose: {
          DEFAULT: "#C99A8E", // dusty rose, акцент №1
        },
        sage: {
          DEFAULT: "#8AA69F", // sage, акцент №2
        },
        sky: {
          DEFAULT: "#6F8AA3", // faded blue, акцент №3
        },
        line: "#E4DFD3",      // тёплая разделительная линия
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        serif: [
          "Source Serif 4",
          "Source Serif Pro",
          "Georgia",
          "serif",
        ],
      },
      fontSize: {
        // Generous line-height per PRD: 1.5–1.7
        "body": ["1rem", { lineHeight: "1.65" }],
        "lead": ["1.125rem", { lineHeight: "1.6" }],
        "deck": ["1.25rem", { lineHeight: "1.55" }],
        "display": ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-large": ["clamp(2.5rem, 6.5vw, 5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "subdisplay": ["clamp(1.25rem, 3vw, 1.75rem)", { lineHeight: "1.35" }],
        "observation": ["clamp(1.25rem, 2.4vw, 1.6rem)", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
      },
      transitionTimingFunction: {
        // Сгенерирует utility-класс `ease-out-soft` (Tailwind префиксует ключ через `ease-`).
        "out-soft": "cubic-bezier(0.16, 0.84, 0.3, 1)",
      },
      transitionDuration: {
        "200": "200ms",
        "250": "250ms",
      },
      maxWidth: {
        prose: "38rem",
        narrow: "28rem",
      },
    },
  },
  plugins: [],
};

export default config;
