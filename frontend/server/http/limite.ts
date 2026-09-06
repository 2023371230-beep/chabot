/**
 * Limitador de peticiones por IP.
 *
 * Cubre el hueco que la sesion no cubre: los endpoints que TIENEN que estar
 * abiertos. El webhook de WhatsApp no puede pedir sesion — quien lo llama es
 * Meta — y aunque verifica la firma, calcular un HMAC por cada peticion de una
 * inundacion sigue costando CPU. El limite corta antes de llegar ahi.
 *
 * QUE ESTE LIMITADOR NO ES
 *
 * Vive en memoria del proceso. En Vercel cada instancia lleva su propia cuenta,
 * asi que con varias instancias activas el limite efectivo se multiplica por el
 * numero de instancias. Es una mitigacion parcial y conviene saberlo: la
 * defensa de verdad contra un ataque volumetrico esta en el borde (la
 * proteccion de Vercel, o un WAF delante), no en el codigo de la aplicacion.
 *
 * Aun asi vale la pena. Detiene lo que de verdad llega a un negocio de este
 * tamaño — un script probando contraseñas, un raspador recorriendo la API,
 * alguien reenviando el mismo webhook en bucle — que es trafico de una sola
 * fuente y cae en la misma instancia.
 *
 * Se implementa con ventana deslizante y no con contador por bloque: un
 * contador que se reinicia cada minuto permite el doble del limite a caballo
 * entre dos ventanas, que es justo el hueco que buscan los scripts.
 */

type Ventana = { marcas: number[] };

const ventanas = new Map<string, Ventana>();

/** Tope de llaves vivas, para que un ataque distribuido no llene la memoria. */
const MAX_LLAVES = 10_000;

const limpiar = (ahora: number, ventanaMs: number): void => {
  for (const [llave, v] of ventanas) {
    if (!v.marcas.length || ahora - v.marcas[v.marcas.length - 1] > ventanaMs) {
      ventanas.delete(llave);
    }
  }
};

export type Veredicto =
  | { permitido: true; restantes: number }
  | { permitido: false; reintentarEn: number };

/**
 * Consume una peticion de la cuota.
 *
 * `llave` mezcla el identificador del cliente con el del endpoint para que
 * agotar la cuota de un sitio no bloquee los demas.
 */
export const consumir = (
  llave: string,
  { maximo, ventanaMs }: { maximo: number; ventanaMs: number }
): Veredicto => {
  const ahora = Date.now();

  if (ventanas.size > MAX_LLAVES) limpiar(ahora, ventanaMs);

  const ventana = ventanas.get(llave) ?? { marcas: [] };
  ventana.marcas = ventana.marcas.filter((m) => ahora - m < ventanaMs);

  if (ventana.marcas.length >= maximo) {
    ventanas.set(llave, ventana);
    const masVieja = ventana.marcas[0];
    return { permitido: false, reintentarEn: Math.ceil((ventanaMs - (ahora - masVieja)) / 1000) };
  }

  ventana.marcas.push(ahora);
  ventanas.set(llave, ventana);
  return { permitido: true, restantes: maximo - ventana.marcas.length };
};

/**
 * De quien viene la peticion.
 *
 * Detras de Vercel, `x-forwarded-for` trae la cadena de proxies y el cliente
 * real es el PRIMERO. Tomar el ultimo daria siempre la IP del propio proxy y
 * el limitador acabaria contando a todo el mundo en la misma cuenta.
 *
 * La cabecera se puede falsificar cuando no hay un proxy de confianza delante;
 * por eso este limitador es una capa mas y no la unica.
 */
export const identificar = (req: Request): string => {
  const reenviada = req.headers.get('x-forwarded-for');
  if (reenviada) return reenviada.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'desconocido';
};

/** Solo para pruebas. */
export const olvidarLimites = (): void => ventanas.clear();
