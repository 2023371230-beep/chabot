/**
 * Normalizacion de texto compartida por el pipeline de WhatsApp.
 *
 * Vivia duplicada byte a byte en `whatsapp.intents.ts` y en
 * `whatsapp.matcher.ts`. Los dos archivos son las dos mitades del mismo
 * proceso — intents DECIDE que hacer con el mensaje y matcher RESUELVE que
 * producto es — asi que si una regla de normalizacion cambia en uno y no en el
 * otro, el bot clasifica con un criterio y busca con otro. Ese tipo de
 * divergencia no falla: acierta a medias, que es peor.
 */

/**
 * Deja el texto en minusculas, sin acentos y sin puntuacion.
 *
 * "Pechugá!" y "PECHUGA" acaban siendo la misma cadena, que es lo que permite
 * comparar lo que escribe un cliente con el catalogo.
 */
export const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    // Rango de diacriticos combinantes: lo que NFD separa de cada letra.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 *
 * Sirve para comparar horas sin construir fechas: dos `Date` para saber si son
 * las nueve pasadas es trabajo de mas y arrastra la zona horaria del proceso.
 */
export const aMinutos = (hhmm: string): number => {
  const [horas, minutos] = hhmm.split(':').map(Number);
  return horas * 60 + (minutos || 0);
};
