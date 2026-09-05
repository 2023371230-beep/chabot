import { NextResponse } from 'next/server';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../shared/errors/AppError';

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

export type Sobre<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
  warnings?: string[];
};

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

export const ruta =
  (fn: (req: Request, ctx: Contexto) => Promise<NextResponse>) =>
  async (req: Request, ctx: Contexto): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      return alFallar(error);
    }
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

  // Un error que no es AppError es un fallo nuestro, no del cliente. Se
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
