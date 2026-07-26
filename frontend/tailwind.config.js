/** @type {import('tailwindcss').Config} */
//
// Tailwind is the *secondary* styling surface here: the Classical design
// system in src/styles/design-system.css owns colour, type and spacing. Every
// key below resolves to one of its CSS variables so a utility class and a
// system class can never drift apart — and so both follow the theme when
// [data-theme='dark'] flips the ramps.
export default {
  darkMode: ['class', "[data-theme='dark']"],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // The design system ships its own reset and base type scale. Preflight is
  // loaded after it and would flatten both — headings to body size, lists to
  // no marker — so it is switched off and the system's base layer stands.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        // Lora body / Cormorant Garamond headings, loaded in index.html.
        sans: ['var(--font-body)'],
        serif: ['var(--font-heading)'],
      },
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: {
          DEFAULT: 'var(--color-text)',
          soft: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          muted: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        },
        divider: 'var(--color-divider)',
        // The single accent and its 100–900 tonal ramp. Light steps are
        // tinted fills and hovers, 500 is the base, dark steps carry text on
        // those fills.
        accent: {
          DEFAULT: 'var(--color-accent)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },
        neutral: {
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        chrome: {
          bg: 'var(--chrome-bg)',
          fg: 'var(--chrome-fg)',
          gold: 'var(--chrome-gold)',
        },
        danger: 'var(--color-danger)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
      },
    },
  },
  plugins: [],
}
