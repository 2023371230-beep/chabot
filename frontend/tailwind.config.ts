import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    borderRadius: {
      none: '0px',
      xs: 'var(--r-xs)',
      sm: 'var(--r-sm)',
      DEFAULT: 'var(--r-sm)',
      md: 'var(--r-md)',
      lg: 'var(--r-lg)',
      xl: 'var(--r-lg)',
      '2xl': 'var(--r-lg)',
      '3xl': 'var(--r-lg)',
      full: '9999px'
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        rule: 'hsl(var(--rule))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))'
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          soft: 'hsl(var(--danger-soft))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          soft: 'hsl(var(--info-soft))'
        },
        'on-danger': 'hsl(var(--on-danger))'
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        num: ['var(--font-num)', 'ui-monospace', 'monospace']
      },
      // Escala densa: el salto grande esta en los titulos, no en el cuerpo.
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        md: ['15px', { lineHeight: '22px' }],
        lg: ['17px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        xl: ['20px', { lineHeight: '26px', letterSpacing: '-0.015em' }],
        '2xl': ['26px', { lineHeight: '30px', letterSpacing: '-0.02em' }],
        '3xl': ['34px', { lineHeight: '38px', letterSpacing: '-0.025em' }]
      },
      boxShadow: {
        sm: 'var(--shadow-1)',
        DEFAULT: 'var(--shadow-1)',
        md: 'var(--shadow-2)',
        lg: 'var(--shadow-3)',
        none: '0 0 0 0 transparent'
      },
      spacing: {
        topbar: 'var(--h-topbar)',
        pagebar: 'var(--h-pagebar)'
      },
      height: {
        // Alto exacto del area de trabajo: ventana menos el chrome fijo.
        work: 'calc(100dvh - var(--h-topbar))'
      }
    }
  },
  plugins: [animate]
};

export default config;
