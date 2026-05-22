import { Bot, Brain, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function WhatsappMessagesPlaceholder() {
  const items = [
    { icon: MessageCircle, title: 'Mensajes recientes', text: 'Preparado para listar conversaciones cuando el backend exponga GET.' },
    { icon: Bot, title: 'Estado bot', text: 'Aqui vivira el estado de Baileys o Meta WhatsApp Cloud API.' },
    { icon: Brain, title: 'IA Groq', text: 'El extractor ya esta preparado; falta configurar GROQ_API_KEY.' }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title}>
            <CardHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.text}</p>
              <Badge variant="warning">pendiente</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
