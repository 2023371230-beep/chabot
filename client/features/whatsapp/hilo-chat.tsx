'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { IconAlerta } from '@/client/components/icons';
import { cn } from '@/client/lib/utils';
import type { MensajeChat } from '@/client/types/models';

/**
 * El hilo de una conversacion de WhatsApp.
 *
 * DECISIONES DE FORMA
 *
 * El cliente va a la izquierda y el bot a la derecha, como en cualquier chat:
 * es la convencion que todo el mundo ya conoce y romperla no aporta nada. Los
 * eventos del sistema van al centro, en una linea a lo ancho y no en burbuja,
 * porque no los dijo nadie — son lo que le paso a la conversacion. Es lo que
 * explica que el hilo se corte de golpe cuando el bot se detiene.
 *
 * Las burbujas del bot llevan el color de la marca a media opacidad en vez de
 * relleno solido: en un hilo donde el bot habla tanto como el cliente, dos
 * bloques saturados alternandose cansan la vista en tres mensajes.
 *
 * La hora solo aparece cuando pasan mas de cinco minutos entre un mensaje y el
 * siguiente. Una marca de tiempo en cada burbuja es ruido — lo util es ver
 * DONDE hubo una pausa, porque ahi es donde el cliente se fue a pensarlo.
 */

const PAUSA_QUE_IMPORTA_MS = 5 * 60_000;

export function HiloChat({
  mensajes,
  className,
  autoScroll = false
}: {
  mensajes: MensajeChat[];
  className?: string;
  /** Baja al ultimo mensaje al montar. Para la bandeja, no para el pedido. */
  autoScroll?: boolean;
}) {
  const quieto = useReducedMotion();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    // `auto` y no `smooth`: al abrir un chat se espera estar abajo ya, no ver
    // como se recorre el historico entero delante de uno.
    fin.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [autoScroll, mensajes.length]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {mensajes.map((m, i) => {
        const previo = mensajes[i - 1];
        const salto =
          !previo ||
          new Date(m.en).getTime() - new Date(previo.en).getTime() > PAUSA_QUE_IMPORTA_MS;

        return (
          <div key={m.id} className="flex flex-col gap-2">
            {salto ? (
              <div className="flex justify-center py-1">
                <span className="rounded-full bg-muted px-2.5 py-1 text-2xs text-muted-foreground">
                  {cuando(m.en)}
                </span>
              </div>
            ) : null}

            {m.tipo === 'sistema' ? (
              <EventoSistema texto={m.texto} indice={i} quieto={quieto} />
            ) : (
              <Burbuja mensaje={m} indice={i} quieto={quieto} />
            )}
          </div>
        );
      })}
      <div ref={fin} />
    </div>
  );
}

function Burbuja({
  mensaje,
  indice,
  quieto
}: {
  mensaje: MensajeChat;
  indice: number;
  quieto: boolean | null;
}) {
  const delCliente = mensaje.tipo === 'cliente';
  const delAsesor = mensaje.tipo === 'asesor';

  return (
    <motion.div
      // Entra desde su propio lado: la burbuja del cliente empuja desde la
      // izquierda y la del bot desde la derecha, asi el movimiento ya dice
      // quien habla antes de leer nada.
      initial={quieto ? { opacity: 0 } : { opacity: 0, y: 6, x: delCliente ? -6 : 6 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{
        type: 'spring',
        bounce: 0,
        duration: 0.34,
        // Escalonado corto y con tope: con cuarenta mensajes, esperar dos
        // segundos a que termine de aparecer el hilo seria peor que no animar.
        delay: quieto ? 0 : Math.min(indice * 0.035, 0.4)
      }}
      className={cn('flex', delCliente ? 'justify-start' : 'justify-end')}
    >
      <div
        className={cn(
          'max-w-[min(30rem,85%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          delCliente && 'rounded-bl-md border border-border bg-surface-2',
          // El asesor va del mismo lado que el bot — los dos son "nosotros"
          // para el cliente — pero en otro color y con su etiqueta. El dia que
          // se revise por que alguien se molesto hay que poder distinguir que
          // dijo el asistente y que dijo una persona.
          !delCliente && (delAsesor ? 'rounded-br-md bg-info/15' : 'rounded-br-md bg-primary/15'),
          !delCliente && 'text-foreground'
        )}
      >
        {delAsesor ? (
          <p className="mb-1 text-2xs font-medium uppercase tracking-[0.06em] text-info">
            Asesor
          </p>
        ) : null}
        {/* `whitespace-pre-line`: los resumenes del bot vienen con saltos de
            linea que SON el formato — un pedido de tres cortes en un parrafo
            corrido no se lee. */}
        <p className="whitespace-pre-line break-words">{mensaje.texto}</p>

        <div className="mt-1 flex items-center justify-end gap-1.5">
          {mensaje.error ? (
            <span
              className="flex items-center gap-1 text-2xs text-danger"
              title={mensaje.error}
            >
              <IconAlerta className="h-3 w-3" />
              no se entrego
            </span>
          ) : null}
          <span className="text-2xs text-muted-foreground">{hora(mensaje.en)}</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Un evento del sistema: el bot se detuvo, o una persona lo devolvio.
 *
 * Va a lo ancho y con lineas a los lados porque le pasa a la CONVERSACION, no
 * lo dijo ninguna de las dos partes. Sin esta distincion, un `[HANDOFF]` como
 * burbuja parece un mensaje que el cliente recibio.
 */
function EventoSistema({
  texto,
  indice,
  quieto
}: {
  texto: string;
  indice: number;
  quieto: boolean | null;
}) {
  const limpio = texto.replace(/^\[HANDOFF\]\s*/, '');

  return (
    <motion.div
      initial={quieto ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: quieto ? 0 : Math.min(indice * 0.035, 0.4) }}
      className="flex items-center gap-3 py-1"
    >
      <span className="h-px flex-1 bg-rule" />
      <span className="flex items-center gap-1.5 text-2xs text-warning">
        <IconAlerta className="h-3.5 w-3.5" />
        {limpio}
      </span>
      <span className="h-px flex-1 bg-rule" />
    </motion.div>
  );
}

const hora = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));

/**
 * "Hoy 14:32" o "5 sep, 14:32".
 *
 * Se omite el año salvo que sea otro: en un chat de esta semana, "2026" en
 * cada separador es ruido.
 */
const cuando = (iso: string): string => {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();

  if (mismoDia) return `Hoy ${hora(iso)}`;

  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === hoy.getFullYear() ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};
