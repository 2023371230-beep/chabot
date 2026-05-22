'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { TopNavbar } from './top-navbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <ProtectedRoute>
      {isLogin ? (
        children
      ) : (
        <div className="min-h-screen">
          <TopNavbar />
          <main className="page-shell">{children}</main>
        </div>
      )}
    </ProtectedRoute>
  );
}
