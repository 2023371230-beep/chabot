/**
 * Racionamiento de las peticiones a la IA.
 *
 * El cuello de botella medido contra las cabeceras reales de Groq:
 *
 *     x-ratelimit-limit-requests: 1000    (por dia)
 *     x-ratelimit-limit-tokens:   8000    (por MINUTO)
 *
 * No hay recarga mensual. El limite de tokens por minuto es el que de verdad
 * duele, porque no se agota poco a poco: lo revienta un solo cliente que
 * mande diez mensajes seguidos, y durante ese minuto el bot deja de
 * funcionar para TODOS los demas.
 *
 * Este archivo pone tres cercas, de la mas amplia a la mas estrecha:
 *
 *   1. Presupuesto del dia  -> que no nos quedemos sin cuota a las 3 de la tarde
 *   2. Ritmo por minuto     -> que nadie tire el limite de tokens
 *   3. Cuota por telefono   -> que un solo numero no se coma la cuota de todos
 *
 * Cuando una cerca se cierra el bot NO falla: contesta que en un momento le
 * atiende una persona. Un cliente esperando a alguien es recuperable; un
 * cliente que recibe un error no vuelve.
 *
 * El estado vive en memoria a proposito: son contadores de corto plazo y
 * meterlos a la base costaria una escritura por mensaje. Si el proceso se
 * reinicia, los contadores arrancan de cero — se pierde proteccion durante
 * una ventana, no se rompe nada.
 */

/** Tope diario propio, por debajo de las 1000 de Groq. El resto es colchon. */
const TOPE_DIARIO = 900;

/**
 * Peticiones por minuto. Cada extraccion gasta ~400 tokens entre lo que se
 * manda y lo que vuelve; 15 x 400 = 6000, con margen bajo los 8000/minuto.
 */
const TOPE_POR_MINUTO = 15;

/** Un cliente normal no hace veinte pedidos en una hora. */
const TOPE_POR_TELEFONO_HORA = 20;

/** Ventanas en milisegundos. */
const UN_MINUTO = 60_000;
const UNA_HORA = 3_600_000;

const diaDeHoy = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

type Estado = {
  dia: string;
  usadasHoy: number;
  /** Marcas de tiempo del ultimo minuto. */
  ultimoMinuto: number[];
  /** Marcas por telefono en la ultima hora. */
  porTelefono: Map<string, number[]>;
};

const estado: Estado = {
  dia: diaDeHoy(),
  usadasHoy: 0,
  ultimoMinuto: [],
  porTelefono: new Map()
};

const podar = (marcas: number[], ventana: number, ahora: number): number[] =>
  marcas.filter((m) => ahora - m < ventana);

export type Veredicto =
  | { permitido: true }
  | { permitido: false; motivo: 'dia' | 'minuto' | 'telefono' };

/**
 * Decide si este mensaje puede gastar una peticion de IA.
 *
 * No registra nada: solo opina. Se separa a proposito de `registrarUso` para
 * que una peticion que falle antes de salir no descuente cuota.
 */
export const puedeUsarIA = (telefono: string): Veredicto => {
  const ahora = Date.now();

  // Cambio de dia: se reinicia el presupuesto.
  const hoy = diaDeHoy();
  if (estado.dia !== hoy) {
    estado.dia = hoy;
    estado.usadasHoy = 0;
  }

  if (estado.usadasHoy >= TOPE_DIARIO) return { permitido: false, motivo: 'dia' };

  estado.ultimoMinuto = podar(estado.ultimoMinuto, UN_MINUTO, ahora);
  if (estado.ultimoMinuto.length >= TOPE_POR_MINUTO) {
    return { permitido: false, motivo: 'minuto' };
  }

  const delTelefono = podar(estado.porTelefono.get(telefono) ?? [], UNA_HORA, ahora);
  estado.porTelefono.set(telefono, delTelefono);
  if (delTelefono.length >= TOPE_POR_TELEFONO_HORA) {
    return { permitido: false, motivo: 'telefono' };
  }

  return { permitido: true };
};

/** Se llama justo antes de mandar la peticion a Groq. */
export const registrarUso = (telefono: string): void => {
  const ahora = Date.now();
  estado.usadasHoy += 1;
  estado.ultimoMinuto.push(ahora);
  const previas = estado.porTelefono.get(telefono) ?? [];
  previas.push(ahora);
  estado.porTelefono.set(telefono, previas);
};

/**
 * Que le decimos al cliente cuando se cierra una cerca.
 *
 * Nunca se menciona la palabra "limite" ni "cuota": al cliente no le importa
 * nuestra infraestructura, le importa que alguien le atienda.
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

/** Para el endpoint de salud: cuanta cuota queda. */
export const estadoPresupuesto = () => ({
  dia: estado.dia,
  usadasHoy: estado.usadasHoy,
  topeDiario: TOPE_DIARIO,
  restantesHoy: Math.max(0, TOPE_DIARIO - estado.usadasHoy),
  enElUltimoMinuto: podar(estado.ultimoMinuto, UN_MINUTO, Date.now()).length,
  topePorMinuto: TOPE_POR_MINUTO
});

/** Solo para pruebas: deja los contadores como recien arrancados. */
export const reiniciarPresupuesto = (): void => {
  estado.dia = diaDeHoy();
  estado.usadasHoy = 0;
  estado.ultimoMinuto = [];
  estado.porTelefono.clear();
};
