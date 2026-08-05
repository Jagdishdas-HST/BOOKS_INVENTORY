/** @type {import('tailwindcss').Config} */
//
// Stock Tailwind + NativeWind v4 — NO custom theme tokens. AI picks its own
// colors (e.g. `bg-zinc-900 dark:bg-zinc-50`). Dark mode is media-driven so
// NativeWind v4 toggles `dark:` variants automatically based on the system
// color scheme — no JS hook required.
//
// Spacing / radius / fontSize scales are kept as ergonomic shorthands
// (`p-md`, `rounded-xl`, `text-h1`) — they don't constrain the design, they
// just save AI a few tokens.
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter_800ExtraBold"],
        heading: ["Inter_700Bold"],
        semibold: ["Inter_600SemiBold"],
        medium: ["Inter_500Medium"],
        body: ["Inter_400Regular"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
        "5xl": "48px",
        "6xl": "64px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        full: "9999px",
      },
      fontSize: {
        display: ["40px", { lineHeight: "48px", fontWeight: "800" }],
        h1: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "700" }],
        h3: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        h4: ["18px", { lineHeight: "26px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["15px", { lineHeight: "22px", fontWeight: "500" }],
        label: ["14px", { lineHeight: "20px", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        button: ["16px", { lineHeight: "24px", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};
