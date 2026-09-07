'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSkeleton } from '@/client/components/shared/loading-skeleton';
import { useAuth } from '@/client/hooks/use-auth';

// Interruptor de desarrollo. Con NEXT_PUBLIC_DISABLE_AUTH=true el dashboard
// se abre sin login, util mientras no existe el usuario admin en Supabase.
// El codigo de auth queda intacto: basta quitar la variable para reactivarlo.
const AUTH_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (AUTH_DISABLED) {
      if (isLogin) router.replace('/dashboard');
      return;
    }
    if (loading) return;
    if (!configured) return;
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin) router.replace('/dashboard');
  }, [configured, isLogin, loading, router, user]);

  if (AUTH_DISABLED) return isLogin ? null : <>{children}</>;

  if (loading && configured) {
    return (
      <div className="page-shell">
        <LoadingSkeleton />
      </div>
    );
  }

  if (configured && !user && !isLogin) return null;
  if (configured && user && isLogin) return null;

  return <>{children}</>;
}
