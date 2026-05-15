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
        // Brand: sky blue anchored at #65A4FF
        brand: {
          50: '#eef5ff',
          100: '#dde9ff',
          200: '#c2dafa',
          300: '#91bcff',
          400: '#65a4ff',
          500: '#4188ee',
          600: '#2f72d8',
          700: '#1f5cbd',
          800: '#144495',
          900: '#0b3375',
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
