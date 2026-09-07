import type { Metadata } from 'next';
import { JetBrains_Mono, Onest } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AppShell } from '@/client/components/layout/app-shell';
import { AuthProvider } from '@/client/features/auth/auth-provider';
import './globals.css';

// Onest: grotesca moderna con algo de calidez. Aguanta 12-13px sin
// deshacerse (lo que exige una tabla densa) y no esta sobreusada como Inter,
// asi que no arrastra el aire de plantilla.
const onest = Onest({
  subsets: ['latin'],
  variable: '--font-ui-next',
  display: 'swap'
});

// JetBrains Mono para cifras: figuras tabulares impecables y cero ambiguedad
// entre 0/O y 1/l, que en dinero y kilos importa.
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-num-next',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Bascula',
  description: 'Pedidos, kilos e inventario de la distribuidora'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${onest.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  borderRadius: 'var(--r-md)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--surface))',
                  color: 'hsl(var(--foreground))',
                  boxShadow: 'var(--shadow-3)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px'
                }
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
