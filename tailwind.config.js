/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1976D2',
          light: '#63a4ff',
          dark: '#004ba0',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#4CAF50',
          light: '#80e27e',
          dark: '#087f23',
          foreground: '#ffffff',
        },
        background: '#f8f9fa',
        surface: '#ffffff',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
