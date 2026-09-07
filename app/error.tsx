'use client';

import { IconAlerta } from '@/client/components/icons';
import { Button } from '@/client/components/ui/button';
import { EmptyState } from '@/client/components/shared/empty-state';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-shell">
      <EmptyState
        icon={IconAlerta}
        title="Algo salio mal"
        description="La vista no pudo cargarse. Reintenta o revisa la conexion con el backend."
        action={<Button onClick={() => reset()}>Reintentar</Button>}
      />
    </div>
  );
}
