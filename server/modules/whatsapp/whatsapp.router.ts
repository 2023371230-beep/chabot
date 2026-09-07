import { saludoPorHora, type IntencionRapida } from './whatsapp.intents';
import { Memoria } from './whatsapp.memoria';
import { pasarAPersona } from './whatsapp.handoff';
import { atenderCancelacion, atenderEstado, atenderModificacion } from './whatsapp.postventa';
import { atenderConfirmacion, atenderRepetir } from './whatsapp.pedido';
import { atenderConIA, atenderSoloNumero } from './whatsapp.borrador';
import { armarCatalogo, armarHorario, armarPrecio } from './whatsapp.informacion';
import type { Atencion } from './whatsapp.types';

/**
 * El reparto: de una intencion ya clasificada a quien sabe atenderla.
 *
 * Es deliberadamente tonto — un switch y nada mas. Toda la decision dificil
 * (que es peligroso, que puede esperar, que merece una peticion de IA) ya la
 * tomo whatsapp.intents.ts antes de llegar aqui. Si este archivo empieza a
 * tener condiciones propias, la regla se habra partido en dos sitios.
 */

export async function decidir(
  intencion: IntencionRapida,
  texto: string,
  telefono: string,
  memoria: Memoria,
  nombrePerfil?: string
): Promise<Atencion> {
  const saludo = saludoPorHora();

  switch (intencion.tipo) {
    // Sin contenido: no se contesta. Es la unica rama que devuelve vacio.
    case 'ignorar':
      return { respuesta: '' };

    case 'demasiado_largo':
      return {
        respuesta:
          'Se me hizo muy largo el mensaje para leerlo bien. Digame nada mas el corte y los kilos, por ejemplo: "20 kilos de pechuga para el viernes".'
      };

    case 'humano':
      return pasarAPersona({
        telefono,
        memoria,
        motivo: intencion.motivo,
        nombrePerfil,
        texto
      });

    case 'cancelacion':
      return atenderCancelacion(telefono, memoria, nombrePerfil, texto);

    case 'modificacion':
      return atenderModificacion(texto, telefono, memoria, saludo, nombrePerfil);

    case 'estado_pedido':
      return { respuesta: await atenderEstado(telefono) };

    case 'confirmacion':
      return atenderConfirmacion(telefono, memoria, nombrePerfil, texto);

    case 'rechazo':
      memoria.olvidarCotizacion();
      return { respuesta: 'Sin problema. Aqui andamos por si se anima mas tarde.' };

    case 'repetir':
      return atenderRepetir(telefono, memoria, saludo);

    case 'solo_numero':
      return atenderSoloNumero(telefono, memoria, intencion.valor, nombrePerfil);

    case 'saludo':
      return {
        respuesta: `${saludo}! Con gusto le atiendo. Digame que corte necesita y cuantos kilos, por ejemplo: "15 kilos de pierna para manana".`
      };

    case 'agradecimiento':
      return { respuesta: 'Con gusto, para servirle. Aqui andamos para lo que necesite.' };

    case 'despedida':
      return { respuesta: 'Gracias a usted. Que tenga buen dia.' };

    case 'catalogo':
      return { respuesta: await armarCatalogo(saludo) };

    case 'horario':
      return { respuesta: await armarHorario(saludo) };

    case 'precio':
      return { respuesta: await armarPrecio(intencion.texto, saludo) };

    default:
      return atenderConIA(
        texto,
        telefono,
        memoria,
        nombrePerfil,
        saludo,
        intencion.traeSaludo
      );
  }
}
