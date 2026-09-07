import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { exigirSesion } from './auth';
import { consumir, CUOTAS, identificar } from './limite';

/**
 * El puente entre las rutas de Next y los servicios.
 *
 * Antes esto era Express: `asyncHandler` capturaba los errores, un middleware
 * los traducia a HTTP y `sendSuccess` armaba el sobre de la respuesta. En
 * Next no hay middlewares de error, asi que las tres cosas viven aqui.
 *
 * El sobre `{ success, message, data, errors }` se conserva IDENTICO al de
 * Express a proposito: el frontend ya lo entiende y cambiarlo obligaria a
 * tocar cada pantalla para no ganar nada.
 */

export const ok = <T>(message: string, data?: T, status = 200): NextResponse => {
  // `warnings` sube al nivel del sobre, como hacia `sendSuccess`: el frontend
  // los lee de ahi para pintar los avisos de stock de un pedido.
  const warnings =
    data && typeof data === 'object' && 'warnings' in data
      ? (data as { warnings?: string[] }).warnings
      : undefined;

  return NextResponse.json(
    {
      success: true,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(warnings?.length ? { warnings } : {})
    },
    { status }
  );
};

/**
 * Envuelve un handler y traduce cualquier error a HTTP.
 *
 * Sin esto, una excepcion en un servicio se convierte en un 500 con el stack
 * completo en la respuesta — que en produccion es una fuga de informacion y
 * para el frontend es un mensaje ilegible.
 */
type Contexto = { params: Record<string, string> };

/** Igual que `Contexto`, mas el usuario que ya quedo verificado. */
type ContextoConSesion = Contexto & { user: User };

const demasiadasPeticiones = (segundos: number): NextResponse =>
  NextResponse.json(
    {
      success: false,
      message: 'Demasiadas peticiones. Espera un momento e intenta de nuevo.'
    },
    { status: 429, headers: { 'Retry-After': String(segundos) } }
  );

/**
 * Ruta ABIERTA: sin sesion.
 *
 * Se reserva para lo que de verdad no puede pedirla — hoy solo el webhook de
 * Meta, que se autentica con la firma HMAC de su cuerpo. Todo lo demas usa
 * `rutaPrivada`.
 */
export const ruta =
  (fn: (req: Request, ctx: Contexto) => Promise<NextResponse>) =>
  async (req: Request, ctx: Contexto): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      return alFallar(error);
    }
  };

/**
 * Ruta PRIVADA: exige sesion valida y aplica cuota.
 *
 * Es el envoltorio por defecto. La guarda del navegador (`ProtectedRoute`)
 * solo esconde pantallas; sin esto, un `curl` a `/api/pedidos` devolvia la
 * lista completa con los telefonos de los clientes, y un `PATCH` al estado de
 * un pedido descontaba stock real.
 *
 * La cuota se cuenta por usuario y no por IP: varias personas en el mismo
 * negocio salen por la misma IP, y contarlas juntas castigaria a la segunda
 * por el trabajo de la primera.
 */
export const rutaPrivada =
  (fn: (req: Request, ctx: ContextoConSesion) => Promise<NextResponse>) =>
  async (req: Request, ctx: Contexto): Promise<NextResponse> => {
    try {
      const user = await exigirSesion(req);

      const veredicto = consumir(`api:${user.id}`, CUOTAS.dashboard);
      if (!veredicto.permitido) {
        console.warn(`[limite] usuario ${user.id} excedio la cuota de la API`);
        return demasiadasPeticiones(veredicto.reintentarEn);
      }

      return await fn(req, { ...ctx, user });
    } catch (error) {
      return alFallar(error);
    }
  };

/** Aplica una cuota por IP a una ruta abierta. Devuelve null si puede pasar. */
export const limitarPorIP = (
  req: Request,
  etiqueta: string,
  cuota: { maximo: number; ventanaMs: number }
): NextResponse | null => {
  const veredicto = consumir(`${etiqueta}:${identificar(req)}`, cuota);
  if (veredicto.permitido) return null;
  console.warn(`[limite] ${etiqueta} excedido desde ${identificar(req)}`);
  return demasiadasPeticiones(veredicto.reintentarEn);
};

export const alFallar = (error: unknown): NextResponse => {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        ...(error.errors?.length ? { errors: error.errors } : {})
      },
      { status: error.statusCode }
    );
  }

  // Un error que no es AppError es un fallo del servidor, no del cliente. Se
  // registra completo en el servidor y hacia afuera sale un mensaje neutro.
  console.error('[api] error no controlado:', error);
  return NextResponse.json(
    { success: false, message: 'Error interno del servidor' },
    { status: 500 }
  );
};

/**
 * Lee y valida el cuerpo con el mismo esquema de Zod que usaba Express.
 *
 * Los esquemas no se tocaron en la migracion: son la definicion de que es un
 * dato valido y no tienen nada que ver con el framework.
 */
export const leerCuerpo = async <T>(req: Request, esquema?: ZodTypeAny): Promise<T> => {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    throw new AppError('El cuerpo de la peticion no es JSON valido', 400);
  }

  if (!esquema) return crudo as T;

  const resultado = esquema.safeParse(crudo);
  if (!resultado.success) {
    throw new AppError('Datos invalidos', 400, resultado.error.errors);
  }
  return resultado.data as T;
};

/**
 * Las rutas del dashboard NO se pueden cachear.
 *
 * Next cachea agresivamente por defecto. Sin esto, la lista de pedidos se
 * quedaria congelada en la primera version que se sirvio y el dashboard
 * mostraria datos viejos sin que nada falle a la vista — de los errores mas
 * dificiles de encontrar.
 */
export const dinamico = 'force-dynamic';
