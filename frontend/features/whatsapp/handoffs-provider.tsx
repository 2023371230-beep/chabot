'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { nombreMotivo, recortar } from '@/lib/handoff';
import type { ChatPausado } from '@/types/models';

/**
 * Los chats donde el bot se detuvo y esperan a una persona.
 *
 * VA EN UN CONTEXTO, NO EN UN HOOK POR COMPONENTE
 *
 * Antes cada componente que lo usaba montaba su propio sondeo. En la pantalla
 * de WhatsApp lo usan dos a la vez — el badge de la barra superior y el panel
 * de la pagina — asi que habia dos temporizadores de 15 s (ocho peticiones por
 * minuto en vez de cuatro) y, peor, cada chat nuevo hacia sonar el timbre DOS
 * veces y levantaba DOS avisos identicos. Con el proveedor montado una sola
 * vez en el shell, hay un sondeo y una notificacion.
 *
 * POR QUE SONDEO Y NO SUPABASE REALTIME
 *
 * El navegador habla con Supabase con la llave publica, y RLS esta cerrado
 * para `anon` — que es justo lo que hace segura esta arquitectura. Realtime
 * respeta RLS, asi que una suscripcion desde el navegador no recibiria
 * absolutamente nada, y el fallo seria silencioso: el badge se quedaria en
 * cero para siempre sin un solo error en consola. Una peticion cada 15
 * segundos al servidor, que si tiene permisos, cuesta practicamente nada y
 * funciona de verdad.
 *
 * Un chat esperando 15 segundos de mas no cambia nada; uno que nunca aparece,
 * si.
 */

const CADA = 15_000;

/**
 * Un timbre corto de dos notas, generado en el momento.
 *
 * Se sintetiza en vez de cargar un mp3 para no depender de un archivo que
 * puede faltar en el build, y porque un audio externo no puede sonar hasta que
 * termina de descargar.
 */
const sonar = (): void => {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    // pagina. No es un error que valga la pena reportar: el badge y el aviso
    // siguen funcionando.
  }
};

export type EstadoHandoffs = {
  chats: ChatPausado[];
  total: number;
  cargando: boolean;
  reanudar: (telefono: string) => Promise<void>;
};

const Contexto = createContext<EstadoHandoffs>({
  chats: [],
  total: 0,
  cargando: true,
  reanudar: async () => undefined
});

export function HandoffsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatPausado[]>([]);
  const [cargando, setCargando] = useState(true);

  // En ref y no en estado: comparar contra el valor anterior dentro del
  // intervalo necesita el dato mas reciente, y un estado quedaria congelado en
  // el closure del `setInterval`.
  const previos = useRef<string[] | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const data = await endpoints.whatsapp.handoffs();
      const lista = data?.chats ?? [];
      setChats(lista);

      const ahora = lista.map((c) => c.telefono);
      const antes = previos.current;

      // En la primera carga no se avisa: al abrir el dashboard por la mañana no
      // tiene sentido sonar por chats que llevan ahi desde ayer.
      if (antes) {
        for (const chat of lista.filter((c) => !antes.includes(c.telefono))) {
          sonar();
          toast.warning(nombreMotivo(chat.motivo), {
            description: `${chat.nombreCliente ?? chat.telefono}${
              chat.ultimoMensaje ? `: "${recortar(chat.ultimoMensaje, 70)}"` : ''
            }`,
            duration: 12_000
          });
        }
      }
      previos.current = ahora;
    } catch {
      // Si el servidor no contesta, el punto de "Sin conexion" del navbar ya lo
      // dice. Un aviso de error cada 15 segundos seria insoportable.
    } finally {
      setCargando(false);
    }
  }, []);

  const reanudar = useCallback(async (telefono: string) => {
    await endpoints.whatsapp.reanudar(telefono);
    // Se quita de la lista de inmediato para que el badge no siga encendido
    // mientras llega el siguiente sondeo.
    setChats((prev) => prev.filter((c) => c.telefono !== telefono));
    previos.current = (previos.current ?? []).filter((t) => t !== telefono);
    toast.success('El asistente vuelve a atender ese chat');
  }, []);

  useEffect(() => {
    void refrescar();
    const id = setInterval(() => void refrescar(), CADA);
    return () => clearInterval(id);
  }, [refrescar]);

  return (
    <Contexto.Provider value={{ chats, total: chats.length, cargando, reanudar }}>
      {children}
    </Contexto.Provider>
  );
}

export const useHandoffs = (): EstadoHandoffs => useContext(Contexto);
