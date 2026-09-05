'use client';

import { IconAlerta, IconWhatsapp } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { MOTIVOS, URGENTES, useHandoffs } from '@/hooks/use-handoffs';
import { cn } from '@/lib/utils';

/**
 * Los chats donde el asistente se detuvo.
 *
 * Es la pantalla donde se atiende lo que el bot no puede: un reclamo, un
 * regateo, un pedido que el stock no aguanta. Se ordena por antiguedad — el
 * que lleva mas esperando arriba — porque el costo de un handoff no es que
 * exista, es que se quede olvidado.
 */
export function HandoffPanel() {
  const { chats, cargando, reanudar } = useHandoffs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconAlerta className={cn('h-5 w-5', chats.length && 'text-warning')} />
          Chats esperando a una persona
          {chats.length > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-2xs font-semibold text-warning">
              {chats.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Revisando...</p>
        ) : chats.length === 0 ? (
          <EmptyState
            icon={IconWhatsapp}
            title="El asistente esta atendiendo todo"
            description="Aqui aparecen los chats que el asistente detuvo porque necesitan a una persona."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {chats.map((chat) => {
              const urgente = URGENTES.has(chat.motivo);
              return (
                <li
                  key={chat.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between',
                    urgente ? 'border-danger/40 bg-danger/5' : 'border-border bg-muted/40'
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-2xs font-semibold',
                          urgente
                            ? 'bg-danger/15 text-danger'
                            : 'bg-warning/15 text-warning'
                        )}
                      >
                        {MOTIVOS[chat.motivo] ?? 'Necesita atencion'}
                      </span>
                      <span className="text-sm font-medium">
                        {chat.nombreCliente ?? chat.telefono}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {esperando(chat.pausadoEn)}
                      </span>
                    </div>

                    {chat.ultimoMensaje && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        &ldquo;{chat.ultimoMensaje}&rdquo;
                      </p>
                    )}
                    {chat.detalle && (
                      <p className="mt-0.5 text-2xs text-muted-foreground">{chat.detalle}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`https://wa.me/${chat.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir chat
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void reanudar(chat.telefono)}
                    >
                      Devolver al asistente
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cuanto lleva esperando.
 *
 * Se muestra el tiempo, no la hora: "hace 40 min" pesa distinto que "14:20", y
 * el tiempo esperando es justo el dato que decide a quien se atiende primero.
 */
function esperando(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}
