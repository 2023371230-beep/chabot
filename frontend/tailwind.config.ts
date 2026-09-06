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
      // Escala subida un escalon respecto a la original.
      //
      // Medido en el panel: 31 elementos a 11px, 61 a 13px, y las etiquetas
      // que dicen QUE significa cada numero eran el texto mas chico de la
      // pantalla. Un "718" enorme con "Kilos comprometidos" a 11px se ve pero
      // no se entiende sin acercarse.
      //
      // El salto grande sigue estando en los titulos, no en el cuerpo: la
      // densidad se conserva, solo deja de castigar al que lee de lejos o de
      // pie frente al mostrador.
      fontSize: {
        '2xs': ['13px', { lineHeight: '17px' }],
        xs: ['14px', { lineHeight: '19px' }],
        sm: ['16px', { lineHeight: '22px' }],
        base: ['17px', { lineHeight: '25px' }],
        md: ['18px', { lineHeight: '26px' }],
        lg: ['21px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        xl: ['24px', { lineHeight: '31px', letterSpacing: '-0.015em' }],
        '2xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '3xl': ['38px', { lineHeight: '44px', letterSpacing: '-0.025em' }]
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
