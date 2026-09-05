/**
 * Filtro rapido ANTES de llamar a la IA.
 *
 * Por que existe: la cuenta de Groq da ~1000 peticiones al dia y 8000 tokens
 * por minuto. Cada "buenos dias" que llegue a la IA se come una de esas mil y
 * tarda ~1.5s. Un saludo no necesita un modelo de lenguaje.
 *
 * Pero ahorrar no es lo unico que hace este archivo. Hay mensajes que NO
 * DEBEN llegar a la IA porque la IA hace lo contrario de lo que el cliente
 * quiere. El caso mas caro:
 *
 *     "cancela mi pedido de 20 kilos de pechuga"
 *
 * El modelo ve "20 kilos de pechuga", devuelve intent "pedido" y el sistema
 * CREA un pedido nuevo. El cliente pidio cancelar y termina con el doble.
 * Por eso cancelaciones, quejas, modificaciones y confirmaciones se atajan
 * aqui, con reglas, antes de que el modelo pueda equivocarse.
 *
 * EL ORDEN DE LAS REGLAS ES LA REGLA. Se evalua de mas peligroso a mas
 * inocente: una queja que menciona kilos es una queja, no un pedido.
 */

const normalizar = (t: string): string =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Tope de caracteres que se le manda al modelo.
 *
 * Un mensaje de 3000 caracteres (una cadena reenviada, un spam publicitario)
 * se come el presupuesto de 8000 tokens/minuto y deja sin bot a todos los
 * demas clientes durante un minuto entero. Ningun pedido real necesita mas
 * de 400 caracteres.
 */
export const MAX_CARACTERES_IA = 400;

/** Arriba de esto ya no es un pedido: es una cadena, un spam o un error. */
const MAX_CARACTERES_MENSAJE = 700;

/**
 * Señales de que el cliente SI quiere comprar algo. Si aparece cualquiera, el
 * mensaje va a la IA aunque venga envuelto en saludos.
 *
 * Van con `(?:...)` y `\b` a los dos lados a proposito: sin el grupo, la
 * alternancia solo aplica el limite de palabra al primero y al ultimo, y
 * "apartame" acababa haciendo match dentro de "apartamelo".
 */
const SENALES_DE_PEDIDO = [
  /\d/,
  /\b(?:kilos?|kgs?|kilogramos?)\b/,
  /\b(?:quiero|necesito|ocupo|mandame|mandeme|manda|mande|dame|deme|regalas|regale|vendeme|vendame|apartame|apartamelo|aparta|apartar|encargo|encargar|surte|surta|surtir|llevame|pido|pedir)\b/,
  /\b(?:pechugas?|piernas?|muslos?|alas?|alitas?|patas?|retazo|higado|molleja|pollos?|entero|entera)\b/,
  /\b(?:medio|media|docena)\b/,
  /\b(?:tienes|tiene|hay|manejan)\b/
];

const SALUDOS = [
  /^hola\b/,
  /\bbuen[oa]s? (?:dias|tardes|noches)\b/,
  /^que tal\b/,
  /^que onda\b/,
  /^buenas\b/,
  /^hey\b/,
  /^saludos\b/,
  /^disculpe?\b/,
  /^hay alguien\b/,
  /^info\b/
];

const AGRADECIMIENTOS = [
  /^(?:muchas |mil )?gracias\b/,
  /^grax\b/,
  /^(?:ok|va|vale|perfecto|excelente|listo) gracias\b/,
  /\bse lo agradezco\b/
];

const DESPEDIDAS = [
  /^(?:hasta luego|nos vemos|bye|adios|buen dia|que este bien|feliz dia)\b/,
  /^(?:ok|va|sale|listo|perfecto|de acuerdo|entendido|orale|simon)(?: pues| gracias| entonces)?$/
];

const PIDE_CATALOGO = [
  /\bque (?:tienen|venden|manejan|hay|productos)\b/,
  /\b(?:catalogo|lista de precios|los precios|sus precios)\b/,
  /\bque me puede[sn] ofrecer\b/,
  /\bque productos\b/
];

const PIDE_HORARIO = [/\b(?:horario|a que hora abren|abren|cierran|estan abiertos|hasta que hora)\b/];

const PIDE_PRECIO = [
  /\bcuanto (?:cuesta|vale|sale|esta)\b/,
  /\ba como (?:esta|dan|lo dan|la dan)\b/,
  /\bque precio\b/,
  /\bprecio de\b/,
  /\bcuanto por\b/
];

/** Una cantidad explicita convierte una consulta de precio en pedido. */
const TIENE_CANTIDAD =
  /\d+\s*(?:kilo|kilos|kg|k)\b|\b(?:medio|media|un|una|dos|tres|cuatro|cinco|diez|veinte)\s+(?:kilo|kilos|kg)\b/;

// ── Reglas de alto riesgo ────────────────────────────────────────────────

/**
 * Enojo abierto: groserias, acusaciones de fraude, amenazas de denuncia.
 *
 * Se revisa antes que nada. Un cliente insultando no quiere que le tomen el
 * pedido, quiere que alguien le haga caso, y cada respuesta automatica mas lo
 * enciende. "Profeco" esta en la lista a proposito: cuando alguien la nombra,
 * el asunto ya dejo de ser un pedido.
 */
const ENOJO = [
  /\b(?:pendej[oa]s?|estupid[oa]s?|idiotas?|imbecil|chinga|chingada|chinguen|verga|mierda|puto|puta|malditos?)\b/,
  /\b(?:estafa|estafadores|ladrones|rateros|fraude|transas)\b/,
  /\b(?:porqueria|basura|pesim[oa]|no sirven|son unos)\b/,
  /\b(?:los voy a demandar|demanda|profeco|denuncia|abogado)\b/,
  /\b(?:nunca mas|jamas les vuelvo|ya no les compro)\b/
];

/**
 * Regateo, credito y facturacion.
 *
 * "Te compro 100 kg pero a 30 dias" o "hazme rebaja de $10 por kilo" son
 * decisiones de administracion, no de un bot: un descuento mal dado se cobra
 * de la utilidad y un credito mal dado no se cobra nunca. Ademas la IA, si la
 * dejaramos, contestaria que si — los modelos son complacientes por defecto.
 */
const NEGOCIACION = [
  /\b(?:descuento|rebaja|rebajame|rebajele|mas barato|mejor precio|ultimo precio|buen precio)\b/,
  /\b(?:me lo deja[s]? en|en cuanto me lo deja|no me lo deja|hace[rme]* precio|precio especial)\b/,
  /\b(?:fiado|fiar|me fia|credito|a plazos|abonos|abonar|pago despues|le pago despues|pagar despues)\b/,
  /\ba (?:\d+|quince|treinta) dias\b/,
  /\b(?:factura|facturar|facturacion|constancia fiscal|rfc)\b/,
  /\bprecio (?:de )?(?:mayoreo|mayorista)\b/,
  /\b(?:soy mayorista|para revender|revendo|precio especial)\b/
];

/**
 * Quejas. Se atajan ANTES que cualquier cosa que parezca pedido: un reclamo
 * que menciona kilos sigue siendo un reclamo, y contestarlo con un bot
 * alegre ("con gusto, le anote 3 kilos") es peor que no contestar.
 */
const QUEJAS = [
  /\b(?:echado a perder|podrido|apesta|huele mal|caducad[oa]|verde|baboso)\b/,
  /\b(?:falto|faltaron|faltan|incompleto|equivocad[oa]|no era lo que|no es lo que)\b/,
  /\b(?:no me llego|nunca llego|no llego|no me lo trajeron|no lo trajeron)\b/,
  /\b(?:me cobraron|cobraron de mas|cobro de mas|reclamo|queja|devolucion|devolver|reembolso)\b/,
  /\b(?:vino mal|llego mal|salio mal|esta mal|estaba mal|mala calidad|pesimo|pesima)\b/
];

/**
 * Entrega, direccion y formas de pago.
 *
 * El bot no tiene esos datos: la configuracion del negocio guarda horario y
 * limites de mayoreo, no direccion ni terminal bancaria. Inventarlos seria la
 * peor falla posible — mandar a un cliente a una direccion que no existe — asi
 * que se pasa a una persona, que es quien de verdad coordina la ruta.
 */
const LOGISTICA = [
  /\b(?:a domicilio|me lo llevan|lo llevan|hacen entregas|hacen envios|envian a|reparto|reparten)\b/,
  /\b(?:donde (?:estan|se ubican|los encuentro)|su direccion|la direccion|como llego|ubicacion)\b/,
  /\b(?:aceptan tarjeta|con tarjeta|terminal|transferencia|deposito|efectivo|como (?:les )?pago|formas de pago)\b/,
  /\b(?:cuanto cobran (?:por )?(?:el )?envio|cobran envio|el envio cuesta)\b/
];

const PIDE_HUMANO = [
  /\bhablar con (?:una persona|alguien|un humano|el encargado|el dueno|la dueña|un asesor)\b/,
  /\b(?:me comunica|comuniqueme|paseme con|con una persona|con un humano|atencion a clientes)\b/,
  /\b(?:eres un bot|es un bot|eres una maquina|hablo con un robot)\b/
];

/**
 * Cancelaciones. Requieren una palabra inequivoca (cancelar, anular) o un "ya no"
 * que apunte a un pedido. Un "ya no" suelto es un rechazo de cotizacion, no
 * una cancelacion, y se atiende mas abajo.
 */
const CANCELACIONES = [
  /\bcancel/,
  /\banul/,
  /\bya no (?:lo |la |los |las )?(?:quiero|necesito|ocupo|va)\b.*\b(?:pedido|encargo|nada)\b/,
  /\b(?:borra|elimina|quita) (?:el|mi) pedido\b/,
  /\bya no (?:quiero|necesito) (?:el|mi) (?:pedido|encargo)\b/
];

/**
 * Modificaciones de un pedido que ya existe. Si esto llega a la IA, el
 * sistema crea un SEGUNDO pedido encima del primero y se despacha el doble.
 */
const MODIFICACIONES = [
  /\bmejor que (?:sean|sea|me mande|me manden)\b/,
  /\bmejor (?:son|hazlo|haganlo|ponme|pongame)\b/,
  /\b(?:cambiale|cambia|cambiar|modifica|modificar|corrige) (?:el|mi|la) (?:pedido|orden|cantidad)\b/,
  /\ben (?:vez|lugar) de\b/,
  /\b(?:agregale|agrega|aumentale|aumenta|subele|quitale|quita|bajale|baja) .{0,20}\b(?:al|del|el|mi) pedido\b/,
  /\bal pedido que (?:hice|te hice|le hice|puse)\b/
];

/**
 * Preguntas por el estado de un pedido. Van ANTES que el horario: "a que hora
 * me llega lo que pedi" trae "a que hora" y sin esta prioridad el bot
 * contestaba el horario del negocio, que no es lo que preguntaron.
 */
const ESTADO_PEDIDO = [
  /\bya (?:esta|estan|quedo|salio|se fue|lo mandaron|mandaron)\b/,
  /\b(?:esta|estan) list[oa]s?\b/,
  /\bcuando (?:llega|sale|me lo|lo entregan|entregan|me entregan)\b/,
  /\ba que hora (?:me |lo |la )?(?:llega|llegan|sale|entregan|traen)\b/,
  /\b(?:lo que pedi|el pedido que hice|mi pedido|mi encargo|mi orden)\b/,
  /\bcomo va (?:el|mi) pedido\b/,
  /\bstatus\b/
];

/** "Lo de siempre": se resuelve leyendo el ultimo pedido, no inventandolo. */
const REPETIR = [
  /\blo de siempre\b/,
  /\blo mismo (?:de siempre|de la otra|que la otra|que siempre)\b/,
  /\bcomo (?:la vez pasada|la ultima vez|siempre)\b/,
  /\bmi pedido de siempre\b/
];

/** Respuestas a "se lo aparto?". Solo cuentan en mensajes cortos y sin pedido. */
const AFIRMACIONES = [
  /^(?:si|sip|simon|claro|dale|va|sale|orale|correcto|asi es|exacto|obvio)\b/,
  /^(?:esta bien|de acuerdo|adelante|hagale|mandelo|mandalo|apartelo|apartemelo)\b/
];

const NEGACIONES = [
  /^(?:no|nel|nop|nel pastel)\b/,
  /^(?:mejor no|asi no|todavia no|ahorita no|luego|despues)\b/,
  /^(?:dejalo|dejelo|olvidalo|olvidelo)\b/
];

/** Un "si" o un "no" solo tienen sentido si el mensaje es corto. */
const MAX_LARGO_RESPUESTA_CORTA = 30;

/**
 * Para decidir si un "si" es confirmacion NO sirve la lista general de
 * señales de pedido: "si, apartamelo" trae el verbo "apartamelo" y quedaba
 * clasificado como pedido nuevo. Lo que de verdad convierte un "si" en pedido
 * es que traiga una cifra o nombre un corte ("si, mandame 10 de pechuga").
 */
const MENCIONA_PRODUCTO =
  /\b(?:pechugas?|piernas?|muslos?|alas?|alitas?|patas?|retazo|higado|molleja|pollos?)\b/;

export type IntencionRapida =
  /** Nada que contestar: emoji suelto, un punto, un mensaje vacio. */
  | { tipo: 'ignorar' }
  | { tipo: 'saludo' }
  | { tipo: 'agradecimiento' }
  | { tipo: 'despedida' }
  | { tipo: 'catalogo' }
  | { tipo: 'horario' }
  | { tipo: 'precio'; texto: string }
  | { tipo: 'cancelacion' }
  | { tipo: 'modificacion' }
  | { tipo: 'estado_pedido' }
  | { tipo: 'confirmacion' }
  | { tipo: 'rechazo' }
  | { tipo: 'repetir' }
  | {
      tipo: 'humano';
      motivo: 'queja' | 'solicitud' | 'enojo' | 'negociacion' | 'logistica';
    }
  /** Solo un numero: "20". Responde a una pregunta anterior nuestra. */
  | { tipo: 'solo_numero'; valor: number }
  | { tipo: 'demasiado_largo' }
  | { tipo: 'usar_ia'; traeSaludo: boolean };

/**
 * Clasifica sin gastar un solo token.
 *
 * `traeSaludo` se devuelve incluso cuando el mensaje va a la IA: sirve para
 * que la respuesta abra saludando de vuelta. NO se recorta el saludo del texto
 * antes de mandarlo al modelo — recortar rompe frases como "buenas, de las de
 * ayer", y el ahorro seria de unos pocos tokens.
 */
export const clasificar = (texto: string): IntencionRapida => {
  const crudo = texto ?? '';
  const t = normalizar(crudo);

  // 0. Sin contenido util. Un "👍" no merece respuesta: contestarlo es ruido
  //    para el cliente y una peticion tirada para nosotros.
  if (!t) return { tipo: 'ignorar' };

  // 0b. Demasiado largo para ser un pedido. Se corta aqui para que no se
  //     coma los 8000 tokens/minuto que comparten todos los clientes.
  if (crudo.length > MAX_CARACTERES_MENSAJE) return { tipo: 'demasiado_largo' };

  const traeSaludo = SALUDOS.some((r) => r.test(t));
  const pideAlgo = SENALES_DE_PEDIDO.some((r) => r.test(t));

  // 1. Lo que una maquina no debe contestar sola. El orden es por urgencia:
  //    un cliente enojado no puede esperar a que se evaluen otras diez reglas.
  if (ENOJO.some((r) => r.test(t))) return { tipo: 'humano', motivo: 'enojo' };
  if (QUEJAS.some((r) => r.test(t))) return { tipo: 'humano', motivo: 'queja' };
  if (NEGOCIACION.some((r) => r.test(t))) return { tipo: 'humano', motivo: 'negociacion' };
  if (LOGISTICA.some((r) => r.test(t))) return { tipo: 'humano', motivo: 'logistica' };
  if (PIDE_HUMANO.some((r) => r.test(t))) return { tipo: 'humano', motivo: 'solicitud' };

  // 2. Lo que la IA entenderia al reves.
  if (CANCELACIONES.some((r) => r.test(t))) return { tipo: 'cancelacion' };
  if (MODIFICACIONES.some((r) => r.test(t))) return { tipo: 'modificacion' };
  if (ESTADO_PEDIDO.some((r) => r.test(t))) return { tipo: 'estado_pedido' };
  if (REPETIR.some((r) => r.test(t))) return { tipo: 'repetir' };

  // 3. Respuestas a una pregunta nuestra. Solo en mensajes cortos y sin
  //    cifras ni cortes: "si" es una confirmacion, pero "si tienes pechuga
  //    mandame 10" es un pedido.
  if (
    t.length <= MAX_LARGO_RESPUESTA_CORTA &&
    !/\d/.test(t) &&
    !MENCIONA_PRODUCTO.test(t)
  ) {
    if (AFIRMACIONES.some((r) => r.test(t))) return { tipo: 'confirmacion' };
    if (NEGACIONES.some((r) => r.test(t))) return { tipo: 'rechazo' };
  }

  // 3b. Solo un numero: contesta a un "cuantos kilos?" que preguntamos antes.
  const soloNumero = /^(\d+(?:[.,]\d+)?)$/.exec(t);
  if (soloNumero) {
    return { tipo: 'solo_numero', valor: Number(soloNumero[1].replace(',', '.')) };
  }

  // 4. Datos que ya viven en la base: contestarlos con IA seria pagar por algo
  //    que ya tenemos, con el riesgo extra de que el modelo lo invente.
  if (PIDE_CATALOGO.some((r) => r.test(t))) return { tipo: 'catalogo' };
  if (PIDE_HORARIO.some((r) => r.test(t))) return { tipo: 'horario' };

  // Precio SIN cantidad es consulta. Con cantidad ("cuanto cuesta 20 kilos de
  // pechuga") ya es una cotizacion y necesita a la IA para sacar los kilos.
  if (PIDE_PRECIO.some((r) => r.test(t)) && !TIENE_CANTIDAD.test(t)) {
    return { tipo: 'precio', texto: crudo };
  }

  // 5. Ante la duda, la IA. Perder una venta cuesta mas que una peticion.
  if (pideAlgo) return { tipo: 'usar_ia', traeSaludo };

  // 6. Cortesia pura: no pide nada.
  if (AGRADECIMIENTOS.some((r) => r.test(t))) return { tipo: 'agradecimiento' };
  if (DESPEDIDAS.some((r) => r.test(t))) return { tipo: 'despedida' };
  if (traeSaludo) return { tipo: 'saludo' };

  // 7. Sin señales claras: puede ser un modismo que no previmos. A la IA.
  return { tipo: 'usar_ia', traeSaludo: false };
};

/** Saludo segun la hora de Mexico, para que no diga "buenos dias" a las 8pm. */
export const saludoPorHora = (): string => {
  const hora = Number(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hour12: false
    }).format(new Date())
  );

  if (hora < 12) return 'Buenos dias';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};
