/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./fixtures/content/**/*.{md,mdx}",
    "./fixtures/templates/**/*.njk",
    "./src/**/*.{ts,js}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
