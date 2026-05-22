/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f72e3',
          600: '#3a5bd9',
          700: '#2a47c9',
        },
        surface: {
          900: '#0f1117',
          800: '#161b27',
          700: '#1e2535',
          600: '#262d3f',
          500: '#2e364a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
