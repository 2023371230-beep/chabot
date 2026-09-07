'use client';

import { IconWhatsapp } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BandejaConversaciones } from '@/features/whatsapp/bandeja-conversaciones';
import { HandoffPanel } from '@/features/whatsapp/handoff-panel';
import { WhatsappTestForm } from '@/features/whatsapp/whatsapp-test-form';

/**
 * La pantalla de WhatsApp.
 *
 * El orden es el del trabajo, no el del sistema: primero lo que tiene a un
 * cliente esperando, luego lo que ya paso, y al final la herramienta de
 * pruebas — que es de desarrollo y no debe competir por atencion con un chat
 * detenido.
 */
export default function WhatsappPage() {
  return (
    <PageShell
      fill
      title="WhatsApp"
      description="El asistente toma pedidos solo. Aqui se ve todo lo que ha hablado."
    >
      <div className="grid gap-6">
        <HandoffPanel />

        <BandejaConversaciones />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconWhatsapp className="h-5 w-5" />
              Probar el asistente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WhatsappTestForm />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
