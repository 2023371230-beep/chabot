/**
 * Banco de escenarios reales de WhatsApp.
 *
 * No son casos de laboratorio: son las formas en que la gente de verdad le
 * escribe a una polleria. Cada escenario declara que ESPERAMOS que pase, para
 * poder medir el sistema en vez de opinar sobre el.
 *
 * `espera` describe la decision correcta:
 *   'local'   -> se contesta con reglas, sin gastar una peticion de IA
 *   'ia'      -> hay que entenderlo de verdad, vale la peticion
 *   'bloquea' -> no debe llegar a la IA NI crear nada (peligroso o basura)
 */

export type Espera = 'local' | 'ia' | 'bloquea';

export type Escenario = {
  grupo: string;
  texto: string;
  espera: Espera;
  /** Que se rompe si el sistema falla en este caso. */
  riesgo?: string;
};

export const ESCENARIOS: Escenario[] = [
  // A. Cortesia: no piden nada, no valen una peticion
  { grupo: 'cortesia', texto: 'hola', espera: 'local' },
  { grupo: 'cortesia', texto: 'Buenos dias', espera: 'local' },
  { grupo: 'cortesia', texto: 'buenas tardes joven', espera: 'local' },
  { grupo: 'cortesia', texto: 'Que onda', espera: 'local' },
  { grupo: 'cortesia', texto: 'gracias', espera: 'local' },
  { grupo: 'cortesia', texto: 'muchas gracias!!', espera: 'local' },
  { grupo: 'cortesia', texto: 'ok', espera: 'local' },
  // "va" y "sale pues" son ambiguos a proposito: despues de una cotizacion
  // significan "si, apartamelo"; sueltos son solo un acuse. El clasificador
  // los marca como confirmacion y el servicio decide segun haya o no una
  // cotizacion pendiente. Lo que importa aqui es que ninguno gaste IA.
  { grupo: 'confirmacion', texto: 'va', espera: 'bloquea' },
  { grupo: 'confirmacion', texto: 'sale pues', espera: 'bloquea' },
  { grupo: 'cortesia', texto: 'hasta luego', espera: 'local' },
  { grupo: 'cortesia', texto: 'buenas noches', espera: 'local' },
  { grupo: 'cortesia', texto: 'disculpe', espera: 'local' },

  // B. Datos que ya estan en la base
  { grupo: 'catalogo', texto: 'que tienen?', espera: 'local' },
  { grupo: 'catalogo', texto: 'me pasa su lista de precios', espera: 'local' },
  { grupo: 'catalogo', texto: 'que productos manejan', espera: 'local' },
  { grupo: 'horario', texto: 'a que hora abren?', espera: 'local' },
  { grupo: 'horario', texto: 'cual es su horario', espera: 'local' },
  { grupo: 'horario', texto: 'estan abiertos ahorita?', espera: 'local' },
  { grupo: 'precio', texto: 'cuanto cuesta el kilo de pierna?', espera: 'local' },
  { grupo: 'precio', texto: 'a como esta la pechuga', espera: 'local' },
  { grupo: 'precio', texto: 'que precio tiene el ala', espera: 'local' },

  // C. Pedidos de verdad: aqui SI vale la peticion
  { grupo: 'pedido', texto: '20 kilos de pechuga para el viernes', espera: 'ia' },
  { grupo: 'pedido', texto: 'me das kilo y medio de muslo y 3 de ala pa el lunes', espera: 'ia' },
  { grupo: 'pedido', texto: 'buenas, me manda 10 de pierna porfa', espera: 'ia' },
  { grupo: 'pedido', texto: 'necesito media docena de pollos enteros', espera: 'ia' },
  { grupo: 'pedido', texto: 'apartame 5 kg de retazo', espera: 'ia' },
  { grupo: 'pedido', texto: 'quiero 30 kilos de pechuga y 20 de pierna manana temprano', espera: 'ia' },
  { grupo: 'pedido', texto: 'MANDAME 15 KILOS DE PECHUGA', espera: 'ia' },
  { grupo: 'pedido', texto: 'ocupo 8 kg de pierna pa hoy', espera: 'ia' },
  { grupo: 'pedido', texto: 'me regalas 2 kilos de alita', espera: 'ia' },
  { grupo: 'pedido', texto: 'kilo y medio de pechga', espera: 'ia' },

  // D. Peligrosos: si llegan a la IA pueden crear pedidos falsos
  {
    grupo: 'cancelacion',
    texto: 'cancela mi pedido de 20 kilos de pechuga',
    espera: 'bloquea',
    riesgo: 'La IA extrae 20kg de pechuga y CREA un pedido nuevo en vez de cancelar'
  },
  {
    grupo: 'cancelacion',
    texto: 'ya no quiero el pedido',
    espera: 'bloquea',
    riesgo: 'Puede interpretarse como pedido'
  },
  {
    grupo: 'cancelacion',
    texto: 'mejor cancelalo porfa',
    espera: 'bloquea',
    riesgo: 'El cliente cree que cancelo y no se cancelo nada'
  },
  {
    grupo: 'modificacion',
    texto: 'oiga mejor que sean 30 kilos y no 20',
    espera: 'bloquea',
    riesgo: 'Crea un SEGUNDO pedido de 30kg encima del de 20kg'
  },
  {
    grupo: 'estado',
    texto: 'ya esta listo mi pedido?',
    espera: 'bloquea',
    riesgo: 'Gasta IA para una pregunta que se contesta de la base'
  },
  {
    grupo: 'estado',
    texto: 'a que hora me llega lo que pedi',
    espera: 'bloquea',
    riesgo: 'Igual: dato que ya tenemos'
  },
  {
    grupo: 'confirmacion',
    texto: 'si, apartamelo',
    espera: 'bloquea',
    riesgo: 'El bot pregunto "se lo aparto?" y no sabe leer el SI'
  },
  { grupo: 'confirmacion', texto: 'si porfa', espera: 'bloquea', riesgo: 'Igual' },
  {
    grupo: 'confirmacion',
    texto: 'no, dejalo asi',
    espera: 'bloquea',
    riesgo: 'Podria crear un pedido que el cliente acaba de rechazar'
  },
  {
    grupo: 'queja',
    texto: 'me llego mal el pedido, faltaron 3 kilos',
    espera: 'bloquea',
    riesgo: 'Una queja contestada por un bot enoja mas. Debe ir a una persona'
  },
  {
    grupo: 'queja',
    texto: 'el pollo venia echado a perder',
    espera: 'bloquea',
    riesgo: 'Critico: reclamo de calidad sin humano'
  },
  {
    grupo: 'humano',
    texto: 'quiero hablar con una persona',
    espera: 'bloquea',
    riesgo: 'Ignorarlo es la peor experiencia posible'
  },
  {
    grupo: 'repetir',
    texto: 'lo de siempre porfa',
    espera: 'bloquea',
    riesgo: 'Sin historial la IA inventa; hay que leer el ultimo pedido'
  },

  // E. Basura, abuso y limites tecnicos
  { grupo: 'basura', texto: '\u{1F44D}', espera: 'bloquea', riesgo: 'Emoji solo: la IA no extrae nada, peticion tirada' },
  { grupo: 'basura', texto: '\u{1F602}\u{1F602}\u{1F602}', espera: 'bloquea', riesgo: 'Igual' },
  { grupo: 'basura', texto: '.', espera: 'bloquea', riesgo: 'Igual' },
  { grupo: 'basura', texto: '?', espera: 'bloquea', riesgo: 'Igual' },
  { grupo: 'basura', texto: '', espera: 'bloquea', riesgo: 'Mensaje vacio' },
  {
    grupo: 'basura',
    texto: 'a'.repeat(3000),
    espera: 'bloquea',
    riesgo: 'Revienta el limite de 8000 tokens/min de Groq y tumba el bot para TODOS'
  },
  {
    grupo: 'basura',
    texto: 'Hola buenas te escribo de una promocion exclusiva ' + 'blah '.repeat(400),
    espera: 'bloquea',
    riesgo: 'Spam largo: consume los tokens de los clientes reales'
  },
  { grupo: 'basura', texto: '20', espera: 'bloquea', riesgo: 'Sin contexto un numero solo no significa nada' }
];
