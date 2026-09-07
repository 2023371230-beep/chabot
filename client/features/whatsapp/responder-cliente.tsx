'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { IconAlerta, IconCargando, IconEnviar } from '@/client/components/icons';
import { Button } from '@/client/components/ui/button';
import { Textarea } from '@/client/components/ui/textarea';
import { endpoints } from '@/client/lib/api/endpoints';
import { cn } from '@/client/lib/utils';
import type { MensajeChat } from '@/client/types/models';

/**
 * Escribirle al cliente desde el panel.
 *
 * LA VENTANA DE 24 HORAS
 *
 * WhatsApp solo permite texto libre a alguien que escribio en las ultimas 24
 * horas. Fuera de esa ventana Meta rechaza el mensaje, y descubrirlo DESPUES
 * de redactar un parrafo es la peor forma de enterarse de una limitacion.
 *
 * Por eso el estado de la ventana se calcula ANTES, con la hora del ultimo
 * mensaje del cliente, y se dice arriba del cuadro de texto. Si esta cerrada
 * el campo se deshabilita: dejar escribir para luego fallar es peor que no
 * dejar escribir.
 *
 * EL BOT SE CALLA SOLO
 *
 * Enviar desde aqui silencia al asistente dos horas en ese chat. Se avisa
 * porque es una consecuencia real de la accion, y el usuario tiene que poder
 * predecir que va a pasar.
 */

const VENTANA_MS = 24 * 60 * 60 * 1000;

export function ResponderCliente({
  telefono,
  ultimoDelCliente,
  onEnviado
}: {
  telefono: string;
  ultimoDelCliente: string | null;
  onEnviado: (mensaje: MensajeChat) => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const quieto = useReducedMotion();

  const restante = ultimoDelCliente
    ? VENTANA_MS - (Date.now() - new Date(ultimoDelCliente).getTime())
    : -1;
  const ventanaAbierta = restante > 0;

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    try {
      const mensaje = await endpoints.whatsapp.responder(telefono, limpio);
      onEnviado(mensaje);
      setTexto('');
      toast.success('Mensaje enviado. El asistente queda en pausa 2 horas en este chat.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="border-t border-rule">
      <Aviso abierta={ventanaAbierta} restante={restante} quieto={quieto} />

      <div className="flex items-end gap-2 p-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!ventanaAbierta || enviando}
          rows={2}
          placeholder={
            ventanaAbierta ? 'Escribe tu respuesta...' : 'No se puede escribir ahora mismo'
          }
          aria-label={`Responder a ${telefono}`}
          // Enter envia, Shift+Enter salta de linea: es lo que hace cualquier
          // chat y lo que los dedos ya esperan.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          className="min-h-[3.25rem] resize-none"
        />
        <Button
          variant="primary"
          size="lg"
          disabled={!ventanaAbierta || enviando || !texto.trim()}
          onClick={() => void enviar()}
          title="Enviar (Enter)"
        >
          {enviando ? <IconCargando className="h-4 w-4 animate-spin" /> : <IconEnviar />}
          Enviar
        </Button>
      </div>
    </div>
  );
}

function Aviso({
  abierta,
  restante,
  quieto
}: {
  abierta: boolean;
  restante: number;
  quieto: boolean | null;
}) {
  return (
    <motion.p
      initial={quieto ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex items-start gap-2 px-3 pt-2.5 text-xs leading-relaxed',
        abierta ? 'text-muted-foreground' : 'text-warning'
      )}
    >
      {!abierta ? <IconAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
      <span>
        {abierta ? (
          <>
            Al responder aqui, el asistente queda en pausa 2 horas en este chat para
            no contestar encima de ti. Puedes devolverselo antes con{' '}
            <b className="font-medium text-foreground">Devolver al asistente</b>.{' '}
            <span className="text-muted-foreground/80">
              Quedan {restanteLegible(restante)} para responder por WhatsApp.
            </span>
          </>
        ) : (
          <>
            <b className="font-medium">No se puede escribir a este cliente ahora.</b>{' '}
            WhatsApp solo permite responder dentro de las 24 horas siguientes al
            ultimo mensaje del cliente. Para reabrir la conversacion hace falta una
            plantilla aprobada por Meta.
          </>
        )}
      </span>
    </motion.p>
  );
}

const restanteLegible = (ms: number): string => {
  const horas = Math.floor(ms / 3_600_000);
  if (horas >= 1) return `${horas} h`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min`;
};
