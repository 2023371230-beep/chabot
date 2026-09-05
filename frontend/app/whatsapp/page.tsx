'use client';

import { IconWhatsapp } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsappMessagesPlaceholder } from '@/features/whatsapp/whatsapp-messages-placeholder';
import { WhatsappTestForm } from '@/features/whatsapp/whatsapp-test-form';

export default function WhatsappPage() {
  return (
    <PageShell
      fill
        title="WhatsApp"
        description="Modulo preparado para webhook manual, futura conexion real e IA de extraccion."
    >     <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconWhatsapp className="h-5 w-5" />
              Probar webhook manual
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
