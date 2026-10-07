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
          root: 'var(--bg-root)',
        },
        surface: {
          layer1: 'var(--surface-layer1)',
          layer2: 'var(--surface-layer2)',
          DEFAULT: 'var(--surface-default)'
        },
        border: {
          subtle: 'var(--border-subtle)',
          prominent: 'var(--border-prominent)',
        },
        primary: {
          accent: 'var(--primary-accent)',
          DEFAULT: 'var(--primary-default)'
        },
        wealth: {
          emerald: 'var(--wealth-emerald)',
        },
        bullion: {
          amber: 'var(--bullion-amber)',
        },
        liability: {
          rose: 'var(--liability-rose)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
