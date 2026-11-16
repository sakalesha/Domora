/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        body: 'var(--color-body)',
        ink: 'var(--color-ink)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          pressed: 'var(--color-accent-pressed)',
        },
        'on-accent': 'var(--color-on-accent)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)',
      },
      fontWeight: {
        normal: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        bold: 'var(--font-weight-bold)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        7: 'var(--space-7)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
      },
      maxWidth: {
        auth: 'var(--size-auth-card)',
      },
      height: {
        control: 'var(--size-control)',
      },
      minHeight: {
        control: 'var(--size-control)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        auth: 'var(--shadow-auth)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        out: 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },
      ringWidth: {
        2: 'var(--focus-ring-width)',
      },
      ringOffsetWidth: {
        2: 'var(--focus-ring-offset)',
      },
    },
  },
  plugins: [],
}

