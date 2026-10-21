/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        relay: {
          violet: '#7C3AED',
          cyan: '#06B6D4',
        },
        signal: {
          green: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
        midnight: '#0A0A0A',
        surface: '#131313',
        'surface-2': '#1A1A1A',
        hairline: 'rgba(255,255,255,0.06)',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
    },
  },
  plugins: [],
};