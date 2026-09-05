'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import type { ChatPausado } from '@/types/models';

/**
 * Los chats donde el bot se detuvo y esperan a una persona.
 *
 * POR QUE SONDEO Y NO SUPABASE REALTIME: el frontend habla con Supabase con la
 * llave publica, y RLS esta cerrado para `anon` — que es justo lo que hace
 * segura esta arquitectura. Realtime respeta RLS, asi que una suscripcion
 * desde el navegador no recibiria absolutamente nada y el fallo seria
 * silencioso: el badge se quedaria en cero para siempre sin un solo error en
 * consola. Una peticion cada 15 segundos al backend, que si tiene permisos,
 * cuesta practicamente nada y funciona de verdad.
 *
 * Un chat esperando 15 segundos de mas no cambia nada; uno que nunca aparece,
 * si.
 */

const CADA = 15_000;

/**
 * Un timbre corto de dos notas, generado en el momento.
 *
 * Se sintetiza en vez de cargar un mp3 para no depender de un archivo que
 * puede faltar en el build, y porque un audio externo no puede sonar hasta
 * que termina de descargar.
 */
const sonar = (): void => {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    // Dos notas ascendentes: se distingue del resto de sonidos de un celular
    // sin sonar a alarma de emergencia.
    [880, 1174].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      const inicio = ctx.currentTime + i * 0.14;
      // Rampa en vez de corte seco: un corte suena a "clic" en los altavoces.
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.15, inicio + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.13);
      osc.connect(vol).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.15);
    });

    setTimeout(() => void ctx.close(), 600);
  } catch {
    // El navegador bloquea el audio hasta que el usuario interactua con la
    // pagina. No es un error que valga la pena reportar: el badge y el toast
    // siguen avisando igual.
  }
};

export type UseHandoffs = {
  chats: ChatPausado[];
  total: number;
  cargando: boolean;
  refrescar: () => Promise<void>;
  reanudar: (telefono: string) => Promise<void>;
};

export function useHandoffs(): UseHandoffs {
  const [chats, setChats] = useState<ChatPausado[]>([]);
  const [cargando, setCargando] = useState(true);

  // Se guarda en ref, no en estado: comparar contra el valor anterior dentro
  // del intervalo necesita el dato mas reciente, y un estado quedaria
  // congelado en el closure del setInterval.
  const previos = useRef<string[] | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const data = await endpoints.whatsapp.handoffs();
      const lista = data?.chats ?? [];
      setChats(lista);

      const ahora = lista.map((c) => c.telefono);
      const antes = previos.current;

      // En la primera carga no se avisa: al abrir el dashboard por la mañana
      // no tiene sentido sonar por chats que llevan ahi desde ayer.
      if (antes) {
        const nuevos = lista.filter((c) => !antes.includes(c.telefono));
        for (const chat of nuevos) {
          sonar();
          toast.warning(`${MOTIVOS[chat.motivo] ?? 'Necesita atencion'}`, {
            description: `${chat.nombreCliente ?? chat.telefono}${
              chat.ultimoMensaje ? `: "${recortar(chat.ultimoMensaje, 70)}"` : ''
            }`,
            duration: 12_000
          });
        }
      }
      previos.current = ahora;
    } catch {
      // Si el backend no contesta, el punto de "Sin conexion" del navbar ya lo
      // dice. Un toast de error cada 15 segundos seria insoportable.
    } finally {
      setCargando(false);
    }
  }, []);

  const reanudar = useCallback(
    async (telefono: string) => {
      await endpoints.whatsapp.reanudar(telefono);
      // Se quita de la lista de inmediato para que el badge no siga
      // encendido mientras llega el siguiente sondeo.
      setChats((prev) => prev.filter((c) => c.telefono !== telefono));
      previos.current = (previos.current ?? []).filter((t) => t !== telefono);
      toast.success('El asistente vuelve a atender ese chat');
    },
    []
  );

  useEffect(() => {
    void refrescar();
    const id = setInterval(() => void refrescar(), CADA);
    return () => clearInterval(id);
  }, [refrescar]);

  return { chats, total: chats.length, cargando, refrescar, reanudar };
}

const recortar = (t: string, n: number): string =>
  t.length > n ? `${t.slice(0, n)}...` : t;

/** Como se nombra cada motivo en la interfaz. */
export const MOTIVOS: Record<string, string> = {
  queja: 'Reclamo de calidad',
  enojo: 'Cliente molesto',
  negociacion: 'Pide descuento o credito',
  logistica: 'Pregunta de entrega o pago',
  solicitud: 'Pidio hablar con alguien',
  sin_stock: 'Pedido mayor al stock',
  modificacion: 'Quiere cambiar su pedido',
  sin_cuota: 'Se agoto la cuota del asistente',
  no_entendido: 'El asistente no entendio'
};

/** Los motivos que no pueden esperar: se pintan en rojo, no en ambar. */
export const URGENTES = new Set(['queja', 'enojo']);
