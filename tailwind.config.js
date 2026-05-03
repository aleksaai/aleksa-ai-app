/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#66A4FF',
          600: '#4f8eea',
          700: '#3b78d4',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
