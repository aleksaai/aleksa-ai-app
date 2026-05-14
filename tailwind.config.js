/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
      },
      colors: {
        // Brand: soft lavender / periwinkle anchored at #B2A3FF
        brand: {
          50: '#f6f4ff',
          100: '#ede9ff',
          200: '#ddd5ff',
          300: '#c8bcff',
          400: '#b2a3ff',
          500: '#9d8af5',
          600: '#8676ea',
          700: '#6f5fd8',
          800: '#574bb0',
          900: '#423886',
        },
        canvas: '#fafafb',
        ink: {
          DEFAULT: '#15141c',
          soft: '#3d3a4a',
          muted: '#6c6880',
          dim: '#a7a3b5',
        },
      },
      fontSize: {
        display: ['clamp(2rem, 3vw + 1rem, 3rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 32px -8px rgba(66, 56, 134, 0.12)',
        'glass-lg': '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 24px 60px -20px rgba(66, 56, 134, 0.22)',
      },
    },
  },
  plugins: [],
}
