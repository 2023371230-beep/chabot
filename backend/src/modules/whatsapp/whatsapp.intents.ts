/**
 * Filtro rapido ANTES de llamar a la IA.
 *
 * Por que existe: la cuenta de Groq tiene ~1000 peticiones al dia. Cada
 * "buenos dias" que llegue a la IA se come una de esas mil y tarda ~1.5s en
 * responder. Un saludo no necesita un modelo de lenguaje: se resuelve con
 * reglas y contesta al instante, con cero costo.
 *
 * La regla de corte: solo se atajan mensajes que NO piden nada. En cuanto hay
 * el menor indicio de pedido, pasa a la IA. Es mejor gastar una peticion de
 * mas que contestar con una plantilla a alguien que queria comprar.
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
 * Señales de que el cliente SI quiere algo. Si aparece cualquiera, el mensaje
 * va directo a la IA aunque venga envuelto en saludos.
 */
const SENALES_DE_PEDIDO = [
  /\d/, // cualquier cifra: "20 kilos", "medio kilo" no, pero "1/2" si
  /\bkilo|kilos|kg\b/,
  /\bquiero|necesito|mandame|manda|dame|vendeme|apartame|encargo|pedido|surtir|surte\b/,
  /\bpechuga|pierna|muslo|ala|alas|pata|patas|retazo|higado|molleja|pollo entero\b/,
  /\bmedio|media|docena\b/,
  /\bcuanto cuesta|a como|precio|cuesta|vale\b/,
  /\btienes|hay\b/
];

const SALUDOS = [
  /^hola\b/,
  /\bbuen[oa]s? (dias|tardes|noches)\b/,
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
  /^(muchas )?gracias\b/,
  /^grax\b/,
  /^ok gracias\b/,
  /^va gracias\b/,
  /^perfecto gracias\b/
];

const DESPEDIDAS = [
  /^(hasta luego|nos vemos|bye|adios|buen dia|que este bien)\b/,
  /^(ok|va|sale|listo|perfecto|de acuerdo)$/
];

const PIDE_CATALOGO = [
  /\bque (tienen|venden|manejan|hay)\b/,
  /\bcatalogo|lista de precios|productos\b/,
  /\bque me puedes ofrecer\b/
];

const PIDE_HORARIO = [/\bhorario|a que hora|abren|cierran|estan abiertos\b/];

/**
 * Pregunta por precio. Se ataja ANTES de la IA porque el precio esta en la
 * base: mandarlo al modelo seria gastar una peticion para obtener un dato que
 * ya tenemos, con el riesgo de que lo invente.
 */
const PIDE_PRECIO = [
  /\bcuanto (cuesta|vale|sale|esta)\b/,
  /\ba como (esta|dan|lo dan)\b/,
  /\bque precio\b/,
  /\bprecio de\b/,
  /\bcuanto por\b/
];

/** Una cantidad explicita convierte la consulta en pedido. */
const TIENE_CANTIDAD =
  /\d+\s*(kilo|kilos|kg|k)\b|\b(medio|media|un|una|dos|tres|cuatro|cinco|diez|veinte)\s+(kilo|kilos|kg)\b/;

export type IntencionRapida =
  | { tipo: 'saludo' }
  | { tipo: 'agradecimiento' }
  | { tipo: 'despedida' }
  | { tipo: 'catalogo' }
  | { tipo: 'horario' }
  | { tipo: 'precio'; texto: string }
  | { tipo: 'usar_ia'; traeSaludo: boolean };

/**
 * Clasifica sin gastar un solo token.
 *
 * `traeSaludo` se devuelve incluso cuando el mensaje va a la IA: sirve para
 * que la respuesta abra saludando de vuelta. NO se recorta el saludo del
 * texto antes de mandarlo al modelo — el contexto completo ayuda a la
 * extraccion y recortar puede romper frases como "buenas, de las de ayer".
 */
export const clasificar = (texto: string): IntencionRapida => {
  const t = normalizar(texto);

  if (!t) return { tipo: 'usar_ia', traeSaludo: false };

  const traeSaludo = SALUDOS.some((r) => r.test(t));
  const pidealgo = SENALES_DE_PEDIDO.some((r) => r.test(t));

  if (PIDE_CATALOGO.some((r) => r.test(t))) return { tipo: 'catalogo' };
  if (PIDE_HORARIO.some((r) => r.test(t))) return { tipo: 'horario' };

  // Pregunta de precio SIN cantidad: es una consulta, se contesta de la base.
  // Con cantidad ("cuanto cuesta 20 kilos de pechuga") ya es un pedido y pasa
  // a la IA para que extraiga los kilos.
  if (PIDE_PRECIO.some((r) => r.test(t)) && !TIENE_CANTIDAD.test(t)) {
    return { tipo: 'precio', texto };
  }

  // Ante la duda, la IA. Perder una venta cuesta mas que una peticion.
  if (pidealgo) return { tipo: 'usar_ia', traeSaludo };
  if (AGRADECIMIENTOS.some((r) => r.test(t))) return { tipo: 'agradecimiento' };
  if (DESPEDIDAS.some((r) => r.test(t))) return { tipo: 'despedida' };
  if (traeSaludo) return { tipo: 'saludo' };

  // Mensaje corto y sin señales claras: puede ser "de lo mismo" o un modismo.
  // Se manda a la IA en vez de arriesgar una plantilla equivocada.
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
