import { createClient, type User } from '@supabase/supabase-js';
import { AppError } from '../shared/errors/AppError';

/**
 * Verificacion de sesion para las rutas de la API.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Hasta ahora la autenticacion vivia solo en el navegador: `ProtectedRoute`
 * mandaba a `/login` a quien no tuviera sesion. Eso protege las PANTALLAS, no
 * los DATOS. Un `curl` a `/api/pedidos` devolvia la lista completa con los
 * telefonos de los clientes, y un `PATCH` a `/api/pedidos/<id>/estado` con
 * `confirmado` descontaba stock real. La guarda del frontend es comodidad de
 * navegacion, nunca seguridad — cualquiera puede saltarsela escribiendo la URL
 * de la API a mano.
 *
 * COMO SE VERIFICA
 *
 * El navegador manda el token de Supabase en `Authorization: Bearer <jwt>` y
 * aqui se valida contra el servidor de autenticacion de Supabase, que es quien
 * tiene la llave de firma.
 *
 * Se valida con `getUser(token)` en vez de decodificar el JWT por cuenta
 * propia a proposito. Decodificar a mano es donde aparecen los fallos clasicos
 * de JWT: confusion de algoritmos (cambiar `alg` de RS256 a HS256 y firmar con
 * la clave publica), el algoritmo `none`, o inyeccion por el parametro `kid`.
 * Delegar la verificacion en quien emitio el token elimina esa familia entera
 * de vulnerabilidades en lugar de intentar taparlas una por una.
 *
 * EL COSTE Y COMO SE PAGA
 *
 * Validar contra Supabase es una llamada de red por peticion. Se cachea el
 * resultado unos segundos: un dashboard hace varias peticiones seguidas al
 * pintar una pantalla y no tiene sentido revalidar el mismo token cinco veces
 * en el mismo segundo. La cache es corta a proposito — si se revoca una sesion,
 * deja de servir en segundos, no en minutos.
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cliente con la llave PUBLICA, no la de servicio.
 *
 * Para validar un token basta la llave publica. Usar aqui la `service_role`
 * seria darle a esta funcion permisos que no necesita, y el principio es el
 * contrario: cada pieza con lo minimo para su trabajo.
 */
const verificador =
  url && anon
    ? createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

/** Cuanto se reutiliza la validacion de un mismo token. */
const VIDA_CACHE_MS = 10_000;

/** Tope de entradas, para que la cache no crezca sin freno. */
const MAX_CACHE = 500;

const cache = new Map<string, { user: User; expira: number }>();

const desdeCache = (token: string): User | null => {
  const guardado = cache.get(token);
  if (!guardado) return null;
  if (Date.now() > guardado.expira) {
    cache.delete(token);
    return null;
  }
  return guardado.user;
};

const guardarEnCache = (token: string, user: User): void => {
  if (cache.size >= MAX_CACHE) {
    // Se tira la entrada mas vieja. Un Map conserva el orden de insercion, asi
    // que la primera llave es la que lleva mas tiempo dentro.
    const primera = cache.keys().next().value;
    if (primera) cache.delete(primera);
  }
  cache.set(token, { user, expira: Date.now() + VIDA_CACHE_MS });
};

const extraerToken = (req: Request): string | null => {
  const cabecera = req.headers.get('authorization');
  if (!cabecera) return null;

  const [esquema, token] = cabecera.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
};

/**
 * Devuelve el usuario de la peticion o lanza 401.
 *
 * El mensaje de error es siempre el mismo, sin decir si el token falta, esta
 * vencido o es invalido: cada matiz que se cuenta le ahorra trabajo a quien
 * esta probando tokens a ciegas.
 */
export const exigirSesion = async (req: Request): Promise<User> => {
  if (!verificador) {
    // Sin configuracion no se puede verificar nada. Se falla CERRADO: dejar
    // pasar "porque no hay como comprobar" es como se abren los sistemas.
    console.error('[auth] faltan SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    throw new AppError('El servidor no puede verificar la sesion', 503);
  }

  const token = extraerToken(req);
  if (!token) throw new AppError('Sesion requerida', 401);

  const enCache = desdeCache(token);
  if (enCache) return enCache;

  const { data, error } = await verificador.auth.getUser(token);

  if (error || !data.user) {
    throw new AppError('Sesion requerida', 401);
  }

  guardarEnCache(token, data.user);
  return data.user;
};
