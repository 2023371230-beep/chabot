import { supabase } from '../../database/supabase.client';

/**
 * Racionamiento de las peticiones a la IA.
 *
 * El cuello de botella medido contra las cabeceras reales de Groq:
 *
 *     x-ratelimit-limit-requests: 1000    (por dia)
 *     x-ratelimit-limit-tokens:   8000    (por MINUTO)
 *
 * No hay recarga mensual. El limite de tokens por minuto es el que de verdad
 * duele, porque no se agota poco a poco: lo revienta un solo cliente que mande
 * diez mensajes seguidos, y durante ese minuto el bot deja de funcionar para
 * TODOS los demas.
 *
 * Tres cercas, de la mas amplia a la mas estrecha:
 *
 *   1. Presupuesto del dia  -> que no nos quedemos sin cuota a media jornada
 *   2. Ritmo por minuto     -> que nadie tire el limite de tokens
 *   3. Cuota por telefono   -> que un solo numero no se coma la de todos
 *
 * Cuando una cerca se cierra el bot NO falla: pasa el chat a una persona. Un
 * cliente esperando a alguien es recuperable; uno que recibe un error no
 * vuelve.
 *
 * POR QUE LOS CONTADORES VIVEN EN LA BASE
 *
 * Antes eran variables del proceso. En Vercel cada peticion puede caer en una
 * instancia distinta, asi que cada una contaria desde cero y entre todas se
 * pasarian de las 1000 diarias sin enterarse — justo el limite que esto
 * existe para respetar. Ahora se cuentan filas de `ia_peticiones`, que es lo
 * unico que todas las instancias comparten.
 *
 * El veredicto y los tres contadores salen de UNA sola llamada (la funcion
 * `presupuesto_ia` los calcula en SQL): en serverless cada viaje de red se
 * paga en latencia que el cliente siente.
 */

export type Veredicto =
  | { permitido: true }
  | { permitido: false; motivo: 'dia' | 'minuto' | 'telefono' };

type RespuestaPresupuesto = {
  permitido: boolean;
  motivo: 'dia' | 'minuto' | 'telefono' | null;
  usadas_hoy: number;
  en_el_minuto: number;
  del_telefono: number;
  tope_diario: number;
  restantes_hoy: number;
};

/**
 * Decide si este mensaje puede gastar una peticion de IA.
 *
 * No registra nada: solo opina. Se separa a proposito de `registrarUso` para
 * que una peticion que falle antes de salir no descuente cuota.
 */
export const puedeUsarIA = async (telefono: string): Promise<Veredicto> => {
  const { data, error } = await supabase.rpc('presupuesto_ia', { p_telefono: telefono });

  if (error) {
    // Si no se puede consultar el presupuesto, se deja pasar. Bloquear a todos
    // los clientes por un error de lectura seria peor que arriesgar unas
    // peticiones de mas: el limite real de Groq sigue ahi como ultima red.
    console.error('[presupuesto] no se pudo consultar:', error.message);
    return { permitido: true };
  }

  const r = data as RespuestaPresupuesto;
  if (r.permitido) return { permitido: true };
  return { permitido: false, motivo: r.motivo ?? 'dia' };
};

/** Se llama justo antes de mandar la peticion a Groq. */
export const registrarUso = async (telefono: string): Promise<void> => {
  const { error } = await supabase.from('ia_peticiones').insert({ telefono });
  if (error) console.error('[presupuesto] no se pudo registrar el uso:', error.message);
};

/** Para el endpoint de salud: cuanta cuota queda. */
export const estadoPresupuesto = async () => {
  const { data, error } = await supabase.rpc('presupuesto_ia', { p_telefono: '' });

  if (error) return { disponible: false, error: error.message };

  const r = data as RespuestaPresupuesto;
  return {
    disponible: true,
    usadasHoy: r.usadas_hoy,
    topeDiario: r.tope_diario,
    restantesHoy: r.restantes_hoy,
    enElUltimoMinuto: r.en_el_minuto
  };
};

/**
 * Que le decimos al cliente cuando se cierra una cerca.
 *
 * Nunca se menciona "limite" ni "cuota": al cliente no le importa la
 * infraestructura, le importa que alguien le atienda.
 */
export const mensajeDeEspera = (motivo: 'dia' | 'minuto' | 'telefono'): string => {
  if (motivo === 'telefono') {
    return 'Recibi varios mensajes suyos. Para no equivocarme con el pedido, en un momento le contesta una persona.';
  }
  if (motivo === 'minuto') {
    return 'Deme un segundo, tengo varios pedidos entrando. Vuelva a escribirme su pedido en un minuto, porfa.';
  }
  return 'Por hoy ya no puedo tomar pedidos automaticamente. Digame que necesita y una persona le contesta en un momento.';
};
