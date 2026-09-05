'use client';

import { IconWhatsapp } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HandoffPanel } from '@/features/whatsapp/handoff-panel';
import { WhatsappMessagesPlaceholder } from '@/features/whatsapp/whatsapp-messages-placeholder';
import { WhatsappTestForm } from '@/features/whatsapp/whatsapp-test-form';

export default function WhatsappPage() {
  return (
    <PageShell
      fill
      title="WhatsApp"
      description="El asistente toma pedidos solo. Aqui se ve lo que decidio no contestar."
    >
      <div className="grid gap-6">
        {/* Los chats detenidos van primero: es lo unico de esta pantalla que
            tiene a un cliente esperando del otro lado. */}
        <HandoffPanel />

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

        <WhatsappMessagesPlaceholder />
      </div>
    </PageShell>
  );
}
