/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          root: '#0B0F17',
        },
        surface: {
          layer1: '#151C28',
          layer2: '#1E293B',
          DEFAULT: '#13131b'
        },
        border: {
          subtle: '#222F3E',
          prominent: '#334155',
        },
        primary: {
          accent: '#6366F1',
          DEFAULT: '#c0c1ff'
        },
        wealth: {
          emerald: '#10B981',
        },
        bullion: {
          amber: '#F59E0B',
        },
        liability: {
          rose: '#F43F5E',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
