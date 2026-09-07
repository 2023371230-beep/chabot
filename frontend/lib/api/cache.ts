/**
 * Cache de lecturas de la API, compartida entre pantallas.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Cada pantalla pedia sus datos al montar, sin recordar nada. Medido en el
 * navegador, al volver a Pedidos despues de pasar por Productos:
 *
 *     6 peticiones, y la tabla vacia hasta que la ultima contestaba
 *
 * Los mismos pedidos, los mismos productos y los mismos clientes que se habian
 * traido veinte segundos antes. Mientras tanto la pantalla mostraba su
 * esqueleto de carga, asi que cambiar de menu se sentia lento aunque el clic
 * se hubiera registrado perfectamente.
 *
 * COMO FUNCIONA
 *
 * Se sirve lo que ya se tiene AL INSTANTE y se revalida por detras. El usuario
 * ve la tabla llena en el mismo cuadro en que llega a la pantalla; si algo
 * cambio, se actualiza solo unos cientos de milisegundos despues, sin
 * parpadeo. Es el patron "stale-while-revalidate".
 *
 * POR QUE NO SE USA UNA LIBRERIA
 *
 * Esto son cuarenta lineas y cubre exactamente el caso que hay: unas pocas
 * lecturas de listas que se comparten entre cinco pantallas. Traer react-query
 * añadiria 12 kB al paquete y un modelo mental entero para el mismo resultado.
 *
 * VIVE FUERA DE REACT a proposito: si estuviera en un contexto se perderia al
 * desmontar, que es justo lo que pasa al cambiar de ruta.
 */

type Entrada = { valor: unknown; en: number };

const cache = new Map<string, Entrada>();

/**
 * Cuanto se considera "fresco" un dato.
 *
 * Treinta segundos: lo bastante para que ir y volver entre menus no cueste una
 * peticion, y lo bastante corto para que un pedido creado en otra pestaña
 * aparezca casi enseguida. Aun cuando esta rancio se muestra igual y se
 * revalida por detras, asi que este numero solo decide si ademas se pide.
 */
const VIDA_MS = 30_000;

/** Lo guardado para esa clave, sin importar si esta fresco. */
export const leerCache = <T>(clave: string): T | undefined =>
  cache.get(clave)?.valor as T | undefined;

/** true si lo guardado sigue siendo fresco. */
export const estaFresco = (clave: string): boolean => {
  const e = cache.get(clave);
  return Boolean(e && Date.now() - e.en < VIDA_MS);
};

export const guardarEnCache = (clave: string, valor: unknown): void => {
  cache.set(clave, { valor, en: Date.now() });
};

/**
 * Marca datos como rancios tras una escritura.
 *
 * Se llama al crear o cambiar algo: el pedido nuevo tiene que aparecer en la
 * lista, no esperar treinta segundos. Sin prefijo, invalida todo.
 */
export const invalidar = (prefijo?: string): void => {
  if (!prefijo) {
    cache.clear();
    return;
  }
  for (const clave of cache.keys()) {
    if (clave.startsWith(prefijo)) cache.delete(clave);
  }
};
