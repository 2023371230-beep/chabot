'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-shell">
      <EmptyState
        icon={AlertTriangle}
        title="Algo salio mal"
        description="La vista no pudo cargarse. Reintenta o revisa la conexion con el backend."
        action={<Button onClick={() => reset()}>Reintentar</Button>}
      />
    </div>
  );
}
