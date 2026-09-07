import { aiService } from '../ai/ai.service';
import { productosService } from '../productos/productos.service';
import { formatCurrency, formatKg } from '../../shared/utils/format.utils';
import { buscarProducto, interpretarFecha } from './whatsapp.matcher';
import { MAX_CARACTERES_IA } from './whatsapp.intents';
import { puedeUsarIA, registrarUso } from './whatsapp.presupuesto';
import { pasarAPersona } from './whatsapp.handoff';
import { Memoria, type Renglon } from './whatsapp.memoria';
import type { Atencion } from './whatsapp.types';

/**
 * Del mensaje del cliente a un BORRADOR, nunca a un pedido.
 *
 * Aqui vive la mitad cara del trabajo: la lectura del mensaje, la traduccion
 * de nombres a productos reales y la revision de stock. Y aqui se detiene: lo
 * que sale es siempre una propuesta que el cliente todavia tiene que
 * confirmar. Convertirla en pedido es cosa de whatsapp.pedido.ts, y esa
 * separacion es la doble confirmacion hecha estructura — no un acuerdo que
 * haya que recordar respetar.
 */

/**
 * Tope de kilos por renglon antes de dudar.
 *
 * Un pedido de mayoreo grande son 200 o 300 kilos. Arriba de 500 casi siempre
 * es un dedazo ("2000" en vez de "200") o la IA leyendo mal un numero de
 * telefono. Despachar eso vacia el almacen, asi que se pregunta.
 */
const MAX_KG_RAZONABLE = 500;

/**
 * Cuando el stock se considera insuficiente de verdad.
 *
 * No se frena por faltar un kilo: casi siempre entra mercancia antes de la
 * entrega y rechazar por eso perderia ventas — para esos casos `createOrder`
 * ya devuelve su aviso de stock. Se escala solo cuando la diferencia es grande
 * en las DOS medidas: mas del doble de lo que hay, y al menos 20 kg de mas.
 * Pedir 80 habiendo 30 cumple las dos; pedir 25 habiendo 20, ninguna.
 */
const FACTOR_STOCK_INSUFICIENTE = 2;
const MARGEN_KG_TOLERADO = 20;

/**
 * Cambios de opinion sobre el mismo borrador antes de llamar a una persona.
 *
 * Afinar un pedido es normal: "mejor 30", "agregale alitas". Lo que no es
 * normal es el cuarto cambio sin cerrar — ahi el cliente no esta afinando,
 * esta dudando, y lo que necesita es alguien que le ayude a decidir. Dejarlo
 * dando vueltas con el bot solo alarga la duda.
 */
const MAX_CAMBIOS_BORRADOR = 3;

/**
 * El cierre de todo borrador, y la doble confirmacion en una linea.
 *
 * Dice dos cosas que tienen que quedar explicitas: que el pedido TODAVIA no
 * existe, y exactamente que hacer para que exista. Sin la primera el cliente
 * se va creyendo que ya esta apartado; sin la segunda contesta cualquier cosa
 * y el "si" no se reconoce.
 */
const PIDE_CONFIRMACION = 'Todavia no lo anoto. Me lo confirma con un "si" y se lo aparto.';

/**
 * Cuantos kilos de los pedidos no alcanzan con el stock de hoy.
 *
 * No se rechaza por faltar un kilo: casi siempre entra mas mercancia antes
 * de la entrega y frenar por eso perderia ventas. Se escala solo cuando la
 * diferencia es grande — pedir 300 kg cuando hay 40 no se resuelve con un
 * "puede que no tengamos todo".
 */
export function revisarStock(
  renglones: Renglon[],
  catalogo: Awaited<ReturnType<typeof productosService.findAll>>
): { detalle: string[]; paraElCliente: string[] } {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const detalle: string[] = [];
  const paraElCliente: string[] = [];

  for (const r of renglones) {
    const prod = porId.get(r.producto_id);
    if (!prod) continue;
    const disponible = Number(prod.stock_actual);

    if (r.kg > disponible * FACTOR_STOCK_INSUFICIENTE && r.kg - disponible > MARGEN_KG_TOLERADO) {
      detalle.push(`${prod.nombre}: piden ${formatKg(r.kg)} y hay ${formatKg(disponible)}`);
      // Al cliente se le dice la cantidad REAL. Un "no tenemos suficiente"
      // sin numero lo deja sin poder decidir; con el numero puede pedir lo
      // que si hay y cerrar la venta hoy.
      paraElCliente.push(
        `${prod.nombre}: solo tenemos ${formatKg(disponible)} para entrega inmediata`
      );
    }
  }

  return { detalle, paraElCliente };
}


/**
 * Propone un borrador: lo guarda, vigila la indecision y lo escribe.
 *
 * Todos los caminos que cotizan pasan por aqui — la IA, el numero suelto,
 * "lo de siempre" y las correcciones. Tener un solo sitio es lo que
 * garantiza que ninguno se salte el conteo de cambios ni el "todavia no lo
 * anoto" del final: un camino que se lo saltara volveria a ser un pedido
 * creado sin que el cliente lo confirme.
 */
export async function proponerBorrador(params: {
  telefono: string;
  memoria: Memoria;
  renglones: Renglon[];
  catalogo: Awaited<ReturnType<typeof productosService.findAll>>;
  encabezado: string;
  fechaEntrega?: string;
  notas?: string;
  noEncontrados?: string[];
  nombrePerfil?: string;
  texto?: string;
}): Promise<Atencion> {
  const { telefono, memoria, renglones, catalogo } = params;

  const cambios = memoria.recordarCotizacion(renglones, {
    fechaEntrega: params.fechaEntrega,
    notas: params.notas
  });

  // Cambiar de opinion una y otra vez sin cerrar no lo resuelve otra
  // cotizacion mas: lo resuelve alguien que le ayude a decidir.
  if (cambios >= MAX_CAMBIOS_BORRADOR) {
    memoria.olvidarCotizacion();
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'modificacion',
      detalle: `${cambios} cambios al pedido sin llegar a confirmarlo`,
      nombrePerfil: params.nombrePerfil,
      texto: params.texto
    });
    return {
      respuesta: `Para no equivocarme con los cambios, mejor lo vemos con calma. ${handoff.respuesta}`
    };
  }

  return {
    respuesta: armarCotizacion(renglones, catalogo, params.encabezado, {
      fechaEntrega: params.fechaEntrega,
      noEncontrados: params.noEncontrados
    })
  };
}


/**
 * El borrador escrito para que el cliente lo lea y diga que si.
 *
 * Solo formatea: guardar el borrador es cosa de quien llama, porque hay
 * caminos que necesitan saber cuantas veces se cambio antes de decidir si
 * vale la pena mandarlo. Que exista un unico formateador es lo que hace que
 * el cliente vea siempre la misma forma, venga el borrador de la IA, de un
 * "20" suelto o de un "lo de siempre".
 */
export function armarCotizacion(
  renglones: Renglon[],
  catalogo: Awaited<ReturnType<typeof productosService.findAll>>,
  encabezado: string,
  extra?: { fechaEntrega?: string; noEncontrados?: string[] }
): string {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const lineas = [encabezado, ''];
  let total = 0;
  let kilos = 0;

  for (const r of renglones) {
    const prod = porId.get(r.producto_id);
    if (!prod) continue;
    const sub = r.kg * Number(prod.precio_kg);
    total += sub;
    kilos += r.kg;
    lineas.push(`  ${formatKg(r.kg)} de ${prod.nombre} — ${formatCurrency(sub)}`);
  }

  lineas.push('');
  lineas.push(`Total: ${formatKg(kilos)} — ${formatCurrency(total)}`);

  if (extra?.fechaEntrega) lineas.push(`Entrega: ${extra.fechaEntrega}`);

  if (extra?.noEncontrados?.length) {
    lineas.push('');
    lineas.push(
      `Disculpe, no manejamos ${extra.noEncontrados.join(' ni ')}, por eso no va en la cuenta.`
    );
  }

  lineas.push('');
  lineas.push(PIDE_CONFIRMACION);
  return lineas.join('\n');
}


/**
 * "Mejor que sean 20": corregir la cantidad sin gastar una peticion de IA.
 *
 * Es la correccion mas comun y la que peor se le da al modelo, porque el
 * mensaje NO dice de que corte habla. La IA devolvia un producto vacio y el
 * cliente recibia un "no manejamos ." despues de haberse explicado bien.
 *
 * El dato que falta ya lo tenemos: es el corte que se estaba cotizando. Por
 * eso se resuelve aqui, con una regla, y solo cuando no queda ninguna duda —
 * un unico numero, ningun corte nombrado y un borrador de un solo renglon.
 * En cuanto hay ambiguedad se devuelve `null` y decide la IA.
 */
export async function corregirBorrador(
  texto: string,
  telefono: string,
  memoria: Memoria,
  borrador: { renglones: Renglon[]; fechaEntrega?: string; notas?: string },
  nombrePerfil?: string
): Promise<Atencion | null> {
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numeros.length !== 1) return null;

  const kg = Number(numeros[0].replace(',', '.'));
  if (kg <= 0 || kg > MAX_KG_RAZONABLE) return null;

  const catalogo = await productosService.findAll();

  // Si nombra un corte, el cliente esta cambiando de producto y no solo de
  // cantidad: eso si necesita a la IA para leerlo bien.
  if (buscarProducto(texto, catalogo).encontrado) return null;

  // Con varios renglones no se sabe a cual va el numero. Preguntarlo cuesta
  // un mensaje; adivinarlo puede costar la mitad de un pedido.
  if (borrador.renglones.length !== 1) {
    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const nombres = borrador.renglones
      .map((r) => porId.get(r.producto_id)?.nombre)
      .filter(Boolean);
    return {
      respuesta: `Los ${formatKg(kg)} son de ${nombres.join(' o de ')}? Digame de cual y se lo ajusto.`
    };
  }

  const renglones: Renglon[] = [{ producto_id: borrador.renglones[0].producto_id, kg }];

  const faltante = revisarStock(renglones, catalogo);
  if (faltante.detalle.length) {
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'sin_stock',
      detalle: faltante.detalle.join('; '),
      nombrePerfil,
      texto
    });
    return {
      respuesta: [`${faltante.paraElCliente.join('\n')}.`, '', handoff.respuesta].join('\n')
    };
  }

  return proponerBorrador({
    telefono,
    memoria,
    renglones,
    catalogo,
    encabezado: 'Se lo cambio. Queda asi:',
    fechaEntrega: borrador.fechaEntrega,
    notas: borrador.notas,
    nombrePerfil,
    texto
  });
}


/**
 * El cliente contesto "20" a un "cuantos kilos de pechuga?".
 *
 * Sin esta rama el numero suelto iba a la IA, que no tiene forma de saber de
 * que corte hablamos, y el cliente recibia un "no entendi" despues de haber
 * contestado exactamente lo que le preguntamos.
 */
export async function atenderSoloNumero(
  telefono: string,
  memoria: Memoria,
  valor: number,
  nombrePerfil?: string
): Promise<Atencion> {
  const pendiente = memoria.tomarPreguntaKg();

  if (!pendiente) {
    return {
      respuesta: `${valor} de que corte? Digame por ejemplo "${valor} kilos de pechuga".`
    };
  }

  if (valor <= 0 || valor > MAX_KG_RAZONABLE) {
    memoria.recordarPreguntaKg(pendiente.producto_id, pendiente.nombre);
    return {
      respuesta: `${valor} kilos de ${pendiente.nombre} es bastante. Me confirma la cantidad, porfa?`
    };
  }

  const renglones: Renglon[] = [{ producto_id: pendiente.producto_id, kg: valor }];
  const catalogo = await productosService.findAll();

  const faltante = revisarStock(renglones, catalogo);
  if (faltante.detalle.length) {
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'sin_stock',
      detalle: faltante.detalle.join('; '),
      nombrePerfil,
      texto: String(valor)
    });
    return {
      respuesta: [`${faltante.paraElCliente.join('\n')}.`, '', handoff.respuesta].join('\n')
    };
  }

  // No se crea nada todavia: el numero suelto contesta a "cuantos kilos?",
  // no confirma un pedido. Se le enseña el total y se le pide el "si".
  return proponerBorrador({
    telefono,
    memoria,
    renglones,
    catalogo,
    encabezado: 'Le sale asi:',
    nombrePerfil,
    texto: String(valor)
  });
}


// ── Rama que si gasta IA ──────────────────────────────────────────────

export async function atenderConIA(
  texto: string,
  telefono: string,
  memoria: Memoria,
  nombrePerfil: string | undefined,
  saludo: string,
  traeSaludo: boolean
): Promise<Atencion> {
  // Racionamiento: si ya no hay cuota, se pasa a una persona en vez de
  // fallar. El cliente no tiene por que enterarse de los limites del sistema.
  const cuota = await puedeUsarIA(telefono);
  if (!cuota.permitido) {
    console.warn(`[whatsapp] sin cuota de IA (${cuota.motivo}) para ${telefono}`);
    // Quedarse sin cuota no puede significar quedarse sin atender. Se pasa a
    // una persona, que es exactamente lo que haria un negocio si se le
    // descompone el sistema a media mañana.
    return pasarAPersona({
      telefono,
      memoria,
      motivo: 'sin_cuota',
      detalle: `Se agoto la cuota por ${cuota.motivo}`,
      nombrePerfil,
      texto
    });
  }

  let extraido;
  try {
    await registrarUso(telefono);
    // Recorte defensivo: ningun pedido real necesita mas de 400 caracteres,
    // y un mensaje enorme se come los tokens por minuto de todos.
    const salida = await aiService.extractOrderFromMessage(texto.slice(0, MAX_CARACTERES_IA));
    if (!salida.configured) {
      return {
        respuesta:
          'Ahorita no puedo procesar pedidos automaticamente. Un momento y te atiende una persona.'
      };
    }
    extraido = salida.result;
  } catch (e) {
    console.error('[whatsapp] fallo la IA:', e instanceof Error ? e.message : e);
    return {
      respuesta:
        'No pude entender tu mensaje. Escribeme por ejemplo: "20 kilos de pechuga para el viernes".'
    };
  }

  if (!extraido.productos.length) {
    return noEntendi(telefono, memoria, texto, nombrePerfil, saludo);
  }

  // Traducir nombres a productos reales del catalogo, sin IA.
  const catalogo = await productosService.findAll();
  const renglones: Renglon[] = [];
  const noEncontrados: string[] = [];
  const sinCantidad: { id: string; nombre: string }[] = [];
  const exagerados: string[] = [];
  let sugerencias: string[] = [];

  for (const item of extraido.productos) {
    const match = buscarProducto(item.nombre_producto, catalogo);

    if (!match.encontrado) {
      noEncontrados.push(item.nombre_producto);
      sugerencias = match.sugerencias;
      continue;
    }
    if (!item.kg || item.kg <= 0) {
      sinCantidad.push({ id: match.producto.id, nombre: match.producto.nombre });
      continue;
    }
    // Cordura: "2000 kilos" casi siempre es un dedazo o un numero mal leido.
    if (item.kg > MAX_KG_RAZONABLE) {
      exagerados.push(`${item.kg} kg de ${match.producto.nombre}`);
      continue;
    }
    renglones.push({ producto_id: match.producto.id, kg: item.kg });
  }

  if (exagerados.length) {
    return {
      respuesta: `Me sale ${exagerados.join(' y ')}, y es bastante. Me confirma la cantidad antes de anotarlo?`
    };
  }

  // Preguntar antes que adivinar. Se recuerda QUE se pregunto, para que el
  // "20" que conteste el cliente no necesite otra peticion de IA.
  if (sinCantidad.length) {
    memoria.recordarPreguntaKg(sinCantidad[0].id, sinCantidad[0].nombre);
    return {
      respuesta: `Claro que si. Cuantos kilos de ${sinCantidad.map((s) => s.nombre).join(' y ')} va a necesitar?`
    };
  }

  if (!renglones.length) {
    const lista = sugerencias.length ? `\n\nTenemos: ${sugerencias.join(', ')}.` : '';
    return { respuesta: `No manejamos ${noEncontrados.join(' ni ')}.${lista}` };
  }

  // Stock imposible: el bot no puede prometer lo que no hay. Se revisa
  // ANTES de crear nada, porque un pedido creado ya es una promesa.
  const faltante = revisarStock(renglones, catalogo);
  if (faltante.detalle.length) {
    const handoff = await pasarAPersona({
      telefono,
      memoria,
      motivo: 'sin_stock',
      detalle: faltante.detalle.join('; '),
      nombrePerfil,
      texto
    });
    return {
      respuesta: [
        `${faltante.paraElCliente.join('\n')}.`,
        '',
        handoff.respuesta
      ].join('\n')
    };
  }

  // Se entendio: se borra la cuenta de fallos seguidos.
  memoria.limpiarFallos();

  const fechaEntrega = interpretarFecha(extraido.fecha_entrega) ?? undefined;

  // Aqui NO se crea el pedido, ni cuando el cliente dice "mandame 20 de
  // pechuga". Lo que sale de la IA es una lectura de un mensaje escrito a
  // prisa, y entre esa lectura y despachar pollo tiene que haber un cliente
  // viendo el total y diciendo que si. El pedido nace en `atenderConfirmacion`.
  return proponerBorrador({
    telefono,
    memoria,
    renglones,
    // El catalogo ya esta leido para resolver nombres y revisar stock: se
    // reusa para poner los precios, sin volver a pedir la misma tabla.
    catalogo,
    encabezado: traeSaludo ? `${saludo}! Le sale asi:` : 'Le sale asi:',
    fechaEntrega,
    notas: extraido.notas ?? undefined,
    noEncontrados,
    nombrePerfil,
    texto
  });
}


/**
 * El bot no entendio.
 *
 * A la tercera seguida deja de intentarlo. Por muchas reglas que se
 * escriban siempre habra una forma de escribir que no previmos, y un
 * cliente atrapado en un bucle de "no le entendi" educado termina yendose
 * con la competencia sin que nadie se entere.
 */
export async function noEntendi(
  telefono: string,
  memoria: Memoria,
  texto: string,
  nombrePerfil: string | undefined,
  saludo: string
): Promise<Atencion> {
  const seguidos = memoria.contarFallo();

  if (seguidos >= 3) {
    return pasarAPersona({
      telefono,
      memoria,
      motivo: 'no_entendido',
      detalle: `${seguidos} mensajes seguidos sin entender`,
      nombrePerfil,
      texto
    });
  }

  return {
    respuesta: `${saludo}! No alcance a identificar el pedido. Digame el corte y los kilos, por ejemplo: "20 kilos de pechuga".`
  };
}
