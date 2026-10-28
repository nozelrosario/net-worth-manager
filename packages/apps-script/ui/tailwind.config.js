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
          layer3: 'var(--surface-layer3)',
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
      fontSize: {
        'typ-micro':    ['var(--t-micro)',    { lineHeight: 'var(--lh-tight)' }],
        'typ-caption':  ['var(--t-caption)',  { lineHeight: 'var(--lh-tight)' }],
        'typ-footnote': ['var(--t-footnote)', { lineHeight: 'var(--lh-normal)' }],
        'typ-label':    ['var(--t-label)',    { lineHeight: 'var(--lh-normal)' }],
        'typ-body-sm':  ['var(--t-body-sm)',  { lineHeight: 'var(--lh-normal)' }],
        'typ-body':     ['var(--t-body)',     { lineHeight: 'var(--lh-normal)' }],
        'typ-subtitle': ['var(--t-subtitle)', { lineHeight: 'var(--lh-tight)' }],
        'typ-title':    ['var(--t-title)',    { lineHeight: 'var(--lh-tight)' }],
        'typ-heading':  ['var(--t-heading)',  { lineHeight: 'var(--lh-tight)' }],
        'typ-display':  ['var(--t-display)',  { lineHeight: 'var(--lh-tight)' }],
        'xs':           ['var(--t-label)',    { lineHeight: 'var(--lh-normal)' }],
        'sm':           ['var(--t-body-sm)',  { lineHeight: 'var(--lh-normal)' }],
        'base':         ['var(--t-body)',     { lineHeight: 'var(--lh-normal)' }],
        'lg':           ['var(--t-subtitle)', { lineHeight: 'var(--lh-tight)' }],
        'xl':           ['var(--t-title)',    { lineHeight: 'var(--lh-tight)' }],
        '2xl':          ['var(--t-heading)',  { lineHeight: 'var(--lh-tight)' }],
        '4xl':          ['var(--t-display)',  { lineHeight: 'var(--lh-tight)' }],
      },
      letterSpacing: {
        'typ-tight':  'var(--ls-tight)',
        'typ-normal': 'var(--ls-normal)',
        'typ-wide':   'var(--ls-wide)',
      },
      spacing: {
        'section': 'var(--sp-section-gap)',
        'card-pad': 'var(--sp-card-pad)',
        'input-y': 'var(--sp-input-py)',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
