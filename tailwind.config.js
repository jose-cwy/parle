/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--primary-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        cream: 'var(--cream)',
        ivory: 'var(--ivory)',
        bone: 'var(--bone)',
        beige: 'var(--beige)',
        taupe: 'var(--taupe)',
        rose: 'var(--rose)',
        clay: 'var(--clay)',
        sage: 'var(--sage)',
        ink: 'var(--ink)',
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 12px)',
      },
      fontFamily: {
        serif: ['var(--font-haven-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-haven-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        paper: 'var(--shadow-paper)',
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
      lofi: {
        bg: '#1f1814',
        card: 'rgba(45, 35, 28, 0.72)',
        warm: '#ffb347',
        cool: '#6b7b4c',
        text: '#fff9f0',
        muted: '#a89480',
      },
    },
  },
  plugins: [],
}
