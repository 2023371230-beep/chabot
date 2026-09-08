'use client';

import { IconWhatsapp } from '@/client/components/icons';
import { PageShell } from '@/client/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { BandejaConversaciones } from '@/client/features/whatsapp/bandeja-conversaciones';
import { HandoffPanel } from '@/client/features/whatsapp/handoff-panel';
import { WhatsappTestForm } from '@/client/features/whatsapp/whatsapp-test-form';

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
      // Sin `fill`: el contenido de esta pantalla crece con los chats que
      // haya, asi que tiene que poder scrollear. Con `fill` no lo hacia, y el
      // panel de "Probar el asistente" quedaba fuera de alcance.
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
