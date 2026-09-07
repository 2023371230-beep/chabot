'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import { ConfigurationForm, type ConfigurationFormValues } from '@/features/configuracion/configuration-form';

export default function ConfiguracionPage() {
  const config = useApi(() => endpoints.configuracion.get(), [], 'configuracion');
  const [submitting, setSubmitting] = useState(false);

  if (config.loading) return <LoadingSkeleton />;
  if (config.error) {
    return (
      <ErrorState
        title="No se pudo cargar la configuracion"
        description={config.error}
        onRetry={config.refetch}
      />
    );
  }
  if (!config.data) return null;
  const currentConfig = config.data;

  const save = async (values: ConfigurationFormValues) => {
    setSubmitting(true);
    try {
      await endpoints.configuracion.update(currentConfig.id, values);
      toast.success('Configuracion actualizada');
      await config.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      fill
        title="Configuracion"
        description="Reglas operativas que el backend usa para advertencias de mayoreo y fuera de horario."
    >     <Card>
        <CardHeader>
          <CardTitle>Reglas de negocio</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigurationForm config={currentConfig} onSubmit={save} submitting={submitting} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
