/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand)",
        ink: "var(--ink)",
        danger: "var(--danger)",
        surface: "var(--surface)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
      },
      fontFamily: { sans: ["var(--font)"], data: ["var(--font-data)"] },
    },
  },
  plugins: [],
};
