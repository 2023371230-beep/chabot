'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/client/features/auth/protected-route';
import { HandoffsProvider } from '@/client/features/whatsapp/handoffs-provider';
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

  /**
   * La hoja imprimible va sin barra de navegacion.
   *
   * No basta con esconderla al imprimir: lo que se ve en pantalla tiene que
   * ser lo que sale en papel, o el usuario no puede confiar en la vista
   * previa.
   */
  const esImprimible = pathname.startsWith('/reportes/imprimir');

  return (
    <ProtectedRoute>
      {esImprimible ? (
        <div className="min-h-dvh overflow-y-auto">{children}</div>
      ) : isLogin ? (
        <div className="h-dvh overflow-y-auto">{children}</div>
      ) : (
        // El proveedor de handoffs envuelve el shell y no cada consumidor: asi
        // hay UN sondeo y UNA notificacion por chat nuevo, aunque lo lean el
        // badge de la barra y el panel de WhatsApp a la vez.
        <HandoffsProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <TopNavbar />
          {/* min-h-0 es obligatorio: sin el, el hijo flex se niega a encogerse
              y el scroll interno se rompe. */}
          <main className="min-h-0 flex-1">{children}</main>
        </div>
        </HandoffsProvider>
      )}
    </ProtectedRoute>
  );
}
