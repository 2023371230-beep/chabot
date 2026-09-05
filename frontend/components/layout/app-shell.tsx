'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { TopNavbar } from './top-navbar';

/**
 * Shell de altura fija.
 *
 * La ventana no scrollea nunca: el <body> tiene overflow hidden y cada region
 * de contenido scrollea por dentro. Asi la barra superior y la barra de pagina
 * quedan siempre visibles y el area de trabajo ocupa el alto exacto que sobra,
 * sin espacio muerto abajo ni en pantallas grandes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <ProtectedRoute>
      {isLogin ? (
        <div className="h-dvh overflow-y-auto">{children}</div>
      ) : (
        <div className="flex h-dvh flex-col overflow-hidden">
          <TopNavbar />
          {/* min-h-0 es obligatorio: sin el, el hijo flex se niega a encogerse
              y el scroll interno se rompe. */}
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      )}
    </ProtectedRoute>
  );
}
