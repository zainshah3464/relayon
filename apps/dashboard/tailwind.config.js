/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════
      // COLORS — semantic + backward-compatible with v3.7 classes
      // ═══════════════════════════════════════════════════════════
      colors: {
        // ── Backgrounds (blue-tinted dark, not pure black) ──
        midnight: '#09090E',        // page base — deeper than before
        surface: '#0F0F15',         // sidebar, cards — subtle elevation
        'surface-2': '#16161F',     // inputs, dropdowns — more contrast
        'surface-3': '#1D1D28',     // hover states (NEW)
        'surface-4': '#262633',     // active/pressed (NEW)

        // ── Borders ──
        hairline: 'rgba(255,255,255,0.08)',          // default (was 0.06 — too invisible)
        'hairline-strong': 'rgba(255,255,255,0.14)', // NEW — for emphasized dividers
        'hairline-subtle': 'rgba(255,255,255,0.04)', // NEW — for whisper-thin

        // ── Text ──
        foreground: '#F4F4F5',      // NEW — primary text (was hardcoded `text-white`)
        muted: '#71717A',           // secondary (was #6B7280 — slightly warmer)
        'muted-2': '#52525B',       // NEW — tertiary/disabled

        // ── Brand ──
        relay: {
          violet: '#8B5CF6',        // primary brand (was #7C3AED — warmer, more premium)
          'violet-dim': '#7C3AED',  // hover/pressed
          'violet-deep': '#6D28D9', // deep accent
          cyan: '#06B6D4',          // secondary (kept)
          'cyan-dim': '#0891B2',    // hover
        },

        // ── Signals ──
        signal: {
          green: '#10B981',
          'green-dim': '#059669',
          amber: '#F59E0B',
          'amber-dim': '#D97706',
          rose: '#F43F5E',
          'rose-dim': '#E11D48',
        },

        // ── Info (NEW — was missing) ──
        info: {
          DEFAULT: '#3B82F6',
          dim: '#2563EB',
        },
      },

      // ═══════════════════════════════════════════════════════════
      // TYPOGRAPHY
      // ═══════════════════════════════════════════════════════════
      fontFamily: {
        sans: ['Geist Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        urdu: ['Noto Nastaliq Urdu', 'serif'],
        arabic: ['Noto Sans Arabic', 'sans-serif'],
      },

      // Tighter, more deliberate scale — compact by design
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px
        xs: ['0.6875rem', { lineHeight: '1rem' }],         // 11px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],      // 13px
        base: ['0.875rem', { lineHeight: '1.375rem' }],    // 14px
        md: ['0.9375rem', { lineHeight: '1.5rem' }],       // 15px
        lg: ['1.0625rem', { lineHeight: '1.5rem' }],       // 17px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],        // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],         // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],    // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],      // 36px
        '5xl': ['3rem', { lineHeight: '1' }],              // 48px
      },

      letterSpacing: {
        tightest: '-0.03em',
        tighter: '-0.02em',
        tight: '-0.015em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
        widest: '0.08em',
      },

      // ═══════════════════════════════════════════════════════════
      // RADIUS — tighter, more intentional
      // ═══════════════════════════════════════════════════════════
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '10px',    // was 8px
        xl: '14px',    // was 12px
        '2xl': '18px', // was 16px
        '3xl': '24px', // was 24px
      },

      // ═══════════════════════════════════════════════════════════
      // SHADOWS — dark-mode native (glow + soft drop, never harsh)
      // ═══════════════════════════════════════════════════════════
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0,0,0,0.4)',
        sm: '0 1px 3px 0 rgba(0,0,0,0.5), 0 1px 2px -1px rgba(0,0,0,0.4)',
        md: '0 4px 12px -2px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4)',
        lg: '0 8px 24px -4px rgba(0,0,0,0.55), 0 4px 8px -4px rgba(0,0,0,0.4)',
        xl: '0 16px 48px -8px rgba(0,0,0,0.65), 0 8px 16px -8px rgba(0,0,0,0.5)',
        '2xl': '0 24px 64px -12px rgba(0,0,0,0.75)',
        'glow-violet': '0 0 20px -4px rgba(139,92,246,0.4)',
        'glow-cyan': '0 0 20px -4px rgba(6,182,212,0.4)',
        'inner-line': 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      },

      // ═══════════════════════════════════════════════════════════
      // MOTION — spring + out curves only
      // ═══════════════════════════════════════════════════════════
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      transitionDuration: {
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
      },

      // ═══════════════════════════════════════════════════════════
      // ANIMATIONS
      // ═══════════════════════════════════════════════════════════
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out': 'fade-out 150ms cubic-bezier(0.4, 0, 1, 1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.5s linear infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },

      // ═══════════════════════════════════════════════════════════
      // SPACING EXTRAS — for tight compact layouts
      // ═══════════════════════════════════════════════════════════
      spacing: {
        4.5: '1.125rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
        22: '5.5rem',
      },

      backdropBlur: {
        xs: '2px',
      },

      // Content max-widths
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [require('@tailwindcss/container-queries')],
};