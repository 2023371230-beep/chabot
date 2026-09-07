import { configuracionService } from '../configuracion/configuracion.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency } from '../../shared/utils/format.utils';
import { aMinutos } from '../../shared/utils/text.utils';
import { buscarProducto } from './whatsapp.matcher';

/**
 * Lo que se contesta SIN gastar una peticion de IA.
 *
 * Precios, catalogo y horario ya viven en la base. Preguntarselos al modelo
 * seria pagar por un dato que ya se tiene, con el riesgo extra de que lo
 * invente: un precio inventado es una promesa que el mostrador no cumple.
 */

/** Catalogo con precios reales. Se arma de la base, sin IA. */
export async function armarCatalogo(
  saludo: string,
  catalogo?: Awaited<ReturnType<typeof productosService.findAll>>
): Promise<string> {
  const productos = (catalogo ?? (await productosService.findAll())).filter((p) => p.activo);
  if (!productos.length) return `${saludo}. En este momento no tengo productos disponibles.`;

  const lineas = [`${saludo}! Esto es lo que manejamos hoy:`, ''];
  for (const p of productos) {
    lineas.push(`  ${p.nombre} — ${formatCurrency(p.precio_kg)} el kilo`);
  }
  lineas.push('');
  lineas.push('Digame que se lleva y cuantos kilos.');
  return lineas.join('\n');
}


/**
 * Contesta cuanto cuesta un corte. El precio esta en la base: preguntarselo
 * a la IA seria gastar una peticion en un dato que ya esta en la base, con el riesgo
 * de que lo invente.
 */
export async function armarPrecio(texto: string, saludo: string): Promise<string> {
  const catalogo = await productosService.findAll();
  const match = buscarProducto(texto, catalogo);

  if (match.encontrado) {
    const p = match.producto;
    return `${saludo}! El kilo de ${p.nombre} esta en ${formatCurrency(p.precio_kg)}. Cuantos kilos le mando?`;
  }

  // Se le pasa el catalogo ya leido: si no, la caida a "mandar la lista
  // completa" volvia a consultar la misma tabla en el mismo mensaje.
  return armarCatalogo(saludo, catalogo);
}


/** Horario desde la configuracion del negocio, sin IA. */
export async function armarHorario(saludo: string): Promise<string> {
  const config = await configuracionService.getCurrent();
  return `${saludo}! Atendemos de ${config.horario_apertura} a ${config.horario_cierre}. Digame en que le puedo ayudar.`;
}


/**
 * Aviso de que el pedido entra fuera de horario.
 *
 * NO bloquea nada: el pedido se toma igual. Un cliente que escribe a las
 * once de la noche esta comprando, y rechazarlo por la hora seria regalar la
 * venta. Lo unico que hace falta es que no se quede esperando una entrega
 * que no va a salir hasta mañana.
 *
 * El texto sale de `configuracion_empresa.mensaje_fuera_horario`, que existia
 * en la base desde el principio y no lo usaba nadie.
 */
export async function avisoFueraDeHorario(): Promise<string | null> {
  try {
    const config = await configuracionService.getCurrent();
    const aviso = config.mensaje_fuera_horario?.trim();
    if (!aviso) return null;

    const ahora = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    const t = aMinutos(ahora);
    const abre = aMinutos(config.horario_apertura);
    const cierra = aMinutos(config.horario_cierre);

    // Si el cierre es menor que la apertura, el turno cruza la medianoche
    // (por ejemplo 22:00 a 06:00) y la comparacion se invierte.
    const abierto = abre <= cierra ? t >= abre && t < cierra : t >= abre || t < cierra;

    return abierto ? null : aviso;
  } catch (e) {
    // Sin configuracion legible se prefiere no decir nada: un aviso
    // equivocado de horario confunde mas que la ausencia de aviso.
    console.error('[whatsapp] no se pudo revisar el horario:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Que contestar a lo que no es texto.
 *
 * Groq lee texto, punto: un audio o una foto no se pueden procesar. Lo que si
 * se puede es no hacer sentir tonto al cliente y decirle exactamente que
 * hacer, porque un "no entiendo" seco hace que reenvie el mismo audio.
 */
export function respuestaParaNoTexto(tipo: string): string {
  const cierre = 'Escribame por texto que corte necesita y cuantos kilos, y se lo anoto en seguida.';

  switch (tipo) {
    case 'audio':
    case 'voice':
      return `Disculpe, por aqui todavia no puedo escuchar notas de voz. ${cierre}`;
    case 'image':
    case 'video':
    case 'document':
      return `Disculpe, por aqui todavia no puedo ver imagenes ni archivos. ${cierre}`;
    case 'sticker':
      // Un sticker no es una pregunta: se contesta corto y sin regañar.
      return `Aqui andamos! ${cierre}`;
    case 'location':
      return `Gracias por la ubicacion. La entrega la coordina una persona, en un momento le contesta. Si quiere ir adelantando el pedido, ${cierre.toLowerCase()}`;
    default:
      return `Por ahora solo puedo leer mensajes de texto. ${cierre}`;
  }
}
