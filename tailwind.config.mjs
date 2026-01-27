/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Warm, cozy color palette
        cream: '#FDF8F3',
        warmWhite: '#FAF7F2',
        softBrown: '#8B7355',
        warmGray: '#6B6B6B',
        accent: '#C4A77D',
        accentDark: '#A08660',
      },
      fontFamily: {
        sans: ['Georgia', 'serif'],
        heading: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
