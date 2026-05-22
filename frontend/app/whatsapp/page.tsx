'use client';

import { MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsappMessagesPlaceholder } from '@/features/whatsapp/whatsapp-messages-placeholder';
import { WhatsappTestForm } from '@/features/whatsapp/whatsapp-test-form';

export default function WhatsappPage() {
  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Modulo preparado para webhook manual, futura conexion real e IA de extraccion."
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Probar webhook manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WhatsappTestForm />
          </CardContent>
        </Card>
        <WhatsappMessagesPlaceholder />
      </div>
    </>
  );
}
