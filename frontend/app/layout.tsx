import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { AuthProvider } from '@/features/auth/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pollito Admin',
  description: 'Dashboard administrativo para distribuidora avicola'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
