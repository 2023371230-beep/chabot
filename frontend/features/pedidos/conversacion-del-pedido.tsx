'use client';

import { IconPedidos, IconWhatsapp } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HiloChat } from '@/features/whatsapp/hilo-chat';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import type { Pedido } from '@/types/models';

/**
 * Como llego este pedido.
 *
 * Responde a la pregunta que uno se hace al abrir un pedido raro: por que se
 * anotaron esos kilos y no otros. Antes habia que creerle al total; ahora se
 * lee lo que el cliente escribio, con sus palabras.
 *
 * Un pedido capturado desde el panel no tiene conversacion, y eso se DICE en
 * vez de dejar la tarjeta vacia: un hueco sin explicar se lee como que algo
 * fallo al cargar.
 */
export function ConversacionDelPedido({ pedido }: { pedido: Pedido }) {
  const hilo = useApi(
    () => endpoints.pedidos.conversacion(pedido.id),
    [pedido.id],
    `conversacion:${pedido.id}`
  );

  const mensajes = hilo.data ?? [];
  const capturadoAMano = pedido.origen !== 'whatsapp';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {capturadoAMano ? (
            <IconPedidos className="h-5 w-5 opacity-70" />
          ) : (
            <IconWhatsapp className="h-5 w-5 text-success" />
          )}
          Como llego este pedido
        </CardTitle>
      </CardHeader>

      <CardContent>
        {capturadoAMano ? (
          <Nota>
            Este pedido lo capturaste tu desde el panel, asi que no tiene
            conversacion de WhatsApp.
          </Nota>
        ) : hilo.loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando el chat...</p>
        ) : mensajes.length === 0 ? (
          // Pedido de WhatsApp SIN mensajes enlazados: son los anteriores a que
          // el sistema guardara el enlace. Se distingue del capturado a mano
          // porque la causa es otra y el usuario no tiene que deducirla.
          <Nota>
            Este pedido entro por WhatsApp antes de que se guardaran los chats,
            asi que su conversacion no quedo registrada.
          </Nota>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto pr-1">
            <HiloChat mensajes={mensajes} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
