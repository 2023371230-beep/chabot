'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { IconAlerta, IconBuscar, IconWhatsapp } from '@/client/components/icons';
import { EmptyState } from '@/client/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { endpoints } from '@/client/lib/api/endpoints';
import { useApi } from '@/client/hooks/use-api';
import { cn } from '@/client/lib/utils';
import { HiloChat } from './hilo-chat';
import { ResponderCliente } from './responder-cliente';

/**
 * La bandeja de conversaciones.
 *
 * Dos columnas en escritorio — la lista a la izquierda, el hilo a la derecha —
 * porque es como funciona cualquier cliente de mensajeria y el usuario ya sabe
 * usarlo sin que nadie se lo explique.
 *
 * En movil no caben las dos: se muestra la lista, y al tocar una conversacion
 * el hilo la sustituye con un boton para volver. Partir la pantalla en un
 * telefono deja las dos mitades inservibles.
 */
export function BandejaConversaciones() {
  const lista = useApi(() => endpoints.whatsapp.conversaciones(), [], 'conversaciones');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const quieto = useReducedMotion();

  const conversaciones = (lista.data ?? []).filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      c.telefono.includes(q) ||
      (c.nombreCliente ?? '').toLowerCase().includes(q) ||
      c.ultimoMensaje.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconWhatsapp className="h-5 w-5 text-success" />
          Conversaciones
          {conversaciones.length > 0 ? (
            <span className="text-sm font-normal text-muted-foreground">
              {conversaciones.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {lista.loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (lista.data ?? []).length === 0 ? (
          <EmptyState
            icon={IconWhatsapp}
            title="Todavia no hay conversaciones"
            description="Aqui aparece cada chat en cuanto un cliente escriba al numero del negocio."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
            {/* LISTA. En movil se esconde cuando hay un hilo abierto. */}
            <div className={cn('flex flex-col gap-2', abierta && 'hidden lg:flex')}>
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente, telefono o texto"
                aria-label="Buscar en las conversaciones"
              />

              <div className="flex max-h-[30rem] flex-col gap-1 overflow-y-auto pr-1">
                {conversaciones.map((c) => (
                  <button
                    key={c.telefono}
                    type="button"
                    onClick={() => setAbierta(c.telefono)}
                    className={cn(
                      'relative rounded-lg px-3 py-2.5 text-left transition-colors',
                      abierta === c.telefono ? 'text-foreground' : 'hover:bg-muted/60'
                    )}
                  >
                    {/* Misma tecnica que el menu: una sola pastilla que se
                        desliza entre elementos en vez de apagarse y encenderse.
                        El movimiento indica cual se dejo y cual se tomo. */}
                    {abierta === c.telefono ? (
                      <motion.span
                        layoutId={quieto ? undefined : 'conversacion-activa'}
                        className="absolute inset-0 rounded-lg border border-border bg-surface-2"
                        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                      />
                    ) : null}

                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {c.nombreCliente ?? c.telefono}
                        </span>
                        {c.pausada ? (
                          <IconAlerta
                            className="h-3.5 w-3.5 shrink-0 text-warning"
                            aria-label="El asistente esta detenido en este chat"
                          />
                        ) : null}
                        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
                          {cuandoCorto(c.ultimoEn)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.ultimoMensaje.replace(/\n/g, ' ')}
                      </p>
                    </div>
                  </button>
                ))}

                {conversaciones.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Ninguna conversacion coincide con &ldquo;{busqueda}&rdquo;.
                  </p>
                ) : null}
              </div>
            </div>

            {/* HILO */}
            <div className={cn('min-w-0', !abierta && 'hidden lg:block')}>
              {abierta ? (
                <Hilo
                  telefono={abierta}
                  nombre={conversaciones.find((c) => c.telefono === abierta)?.nombreCliente ?? null}
                  ultimoDelCliente={
                    conversaciones.find((c) => c.telefono === abierta)?.ultimoDelCliente ?? null
                  }
                  onVolver={() => setAbierta(null)}
                />
              ) : (
                <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-border">
                  <p className="px-6 text-center text-sm text-muted-foreground">
                    Elige una conversacion para leerla completa.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Hilo({
  telefono,
  nombre,
  ultimoDelCliente,
  onVolver
}: {
  telefono: string;
  nombre: string | null;
  ultimoDelCliente: string | null;
  onVolver: () => void;
}) {
  const hilo = useApi(
    () => endpoints.whatsapp.conversacion(telefono),
    [telefono],
    `conversacion-tel:${telefono}`
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
        <button
          type="button"
          onClick={onVolver}
          className="rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          &larr; Conversaciones
        </button>
        {/* El nombre manda cuando se conoce. La lista de al lado ya lo dice, y
            leer el numero crudo aqui obliga a comparar digitos para saber que
            chat se tiene abierto. El telefono baja a segunda linea, que es
            donde sirve: es el dato que se copia para llamar. */}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-medium">{nombre ?? telefono}</span>
          {nombre ? (
            <span className="block font-num text-xs text-muted-foreground">{telefono}</span>
          ) : null}
        </span>
        <a
          href={`https://wa.me/${telefono.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-primary transition-opacity hover:opacity-80"
        >
          Abrir en WhatsApp
        </a>
      </div>

      <div className="max-h-[26rem] min-h-[14rem] overflow-y-auto p-3">
        {hilo.loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando el chat...</p>
        ) : (
          <HiloChat mensajes={hilo.data ?? []} autoScroll />
        )}
      </div>

      <ResponderCliente
        telefono={telefono}
        ultimoDelCliente={ultimoDelCliente}
        // El mensaje se añade al hilo sin volver a pedirlo: ya se sabe que se
        // envio y esperar una ida y vuelta para verlo hace que el chat se
        // sienta lento justo en el momento en que mas atencion tiene.
        onEnviado={(mensaje) => hilo.setData([...(hilo.data ?? []), mensaje])}
      />
    </div>
  );
}

/** "14:32" si es de hoy, "5 sep" si no. En una lista no cabe mas. */
const cuandoCorto = (iso: string): string => {
  const d = new Date(iso);
  const esHoy = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    ...(esHoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' })
  }).format(d);
};
