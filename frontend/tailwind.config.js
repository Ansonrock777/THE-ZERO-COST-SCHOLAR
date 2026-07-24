/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Body / UI. Inter loaded in index.html, graceful system fallback.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Scholarly display face — used sparingly (wordmark, the "Verified"
        // seal, headings). Spectral loaded in index.html.
        serif: ['Spectral', 'Iowan Old Style', 'Palatino Linotype', 'Georgia', 'serif'],
      },
      colors: {
        // Sidebar chrome + dark surfaces. Deep desaturated pine "ink" — the
        // dark wood of a reading room. (Kept the `navy` key so existing
        // usages pick up the new tone without a rename.)
        navy: {
          950: '#0b1712',
          900: '#10201a',
          800: '#1a2f26',
          700: '#264a3a',
        },
        // Forest-green accent: CTAs, active state, verified checks — the
        // banker's-lamp green of the library.
        forest: {
          DEFAULT: '#1c7a4c',
          dark: '#155f3b',
          light: '#2f9160',
        },
        // Warm parchment for the reading/chat panes in light theme.
        cream: {
          DEFAULT: '#f5f1e8',
          panel: '#fffdf8',
        },
        // Warm ink text on parchment (softer + warmer than cool slate).
        ink: {
          DEFAULT: '#1b2a23',
          soft: '#3d4a43',
          muted: '#7c857d',
        },
        // Citation badges + PDF highlight overlay (the amber highlighter).
        highlight: {
          bg: '#fde68a',
          border: '#f5c451',
          text: '#7c5a10',
        },
      },
    },
  },
  plugins: [],
}
