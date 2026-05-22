'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { useAuth } from '@/hooks/use-auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (loading) return;
    if (!configured) return;
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin) router.replace('/dashboard');
  }, [configured, isLogin, loading, router, user]);

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
