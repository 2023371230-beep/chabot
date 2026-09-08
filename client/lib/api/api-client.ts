import { isSupabaseConfigured, supabase } from '@/client/lib/supabase/supabase-client';
import type { ApiResponse } from '@/client/types/api';

/**
 * Las rutas viven en este mismo proyecto de Next (`app/api/**`), asi que por
 * defecto se habla en relativo: el mismo codigo funciona en localhost y en
 * Vercel sin cambiar nada al desplegar.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/**
 * Segundos antes del vencimiento a partir de los cuales se renueva.
 *
 * Un minuto cubre de sobra el viaje de ida y vuelta de una peticion: mandar
 * un token que caduca en diez segundos es mandarlo caducado.
 */
const MARGEN_RENOVACION = 60;

/**
 * La renovacion en curso, compartida por todas las peticiones.
 *
 * Sin esto hay una carrera que se ve poco y duele mucho: al volver a una
 * pestaña dormida, la pantalla lanza cinco peticiones a la vez, las cinco ven
 * el token vencido y las cinco piden renovar. Supabase INVALIDA el token de
 * refresco en cuanto lo usa una, asi que las otras cuatro reciben "Invalid
 * Refresh Token", se quedan sin token y el usuario ve "Tu sesion expiro" con
 * una sesion que acababa de renovarse correctamente.
 *
 * Con una sola promesa compartida, la primera renueva y las demas esperan a
 * ese mismo resultado.
 */
let renovacionEnCurso: Promise<string | null> | null = null;

const renovarUnaVez = async (): Promise<string | null> => {
  renovacionEnCurso ??= supabase.auth
    .refreshSession()
    .then(({ data }) => data.session?.access_token ?? null)
    .catch(() => null)
    .finally(() => {
      // Se libera para que una renovacion futura pueda volver a intentarlo;
      // si quedara pegada, la sesion no se renovaria nunca mas.
      renovacionEnCurso = null;
    });

  return renovacionEnCurso;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
};

const formatErrorMessage = <T>(payload: ApiResponse<T> | null): string => {
  const details = payload?.errors
    ?.map((error) => {
      if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
      }

      return '';
    })
    .filter(Boolean);

  return [payload?.message, details?.[0]].filter(Boolean).join(': ') ||
    'No se pudo completar la solicitud';
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Token de la sesion actual, renovado si hace falta.
   *
   * `getSession()` NO renueva: devuelve lo que hay guardado. Quien renueva es
   * un temporizador de fondo de Supabase, y ese temporizador no corre con la
   * pestaña en segundo plano ni con el equipo suspendido. El resultado era
   * que el dueño dejaba el dashboard abierto una hora, volvia, tocaba
   * cualquier boton y recibia "Tu sesion expiro. Vuelve a entrar." — con la
   * sesion todavia perfectamente renovable.
   *
   * Por eso se mira la caducidad y se renueva a mano cuando queda poco. El
   * margen de un minuto cubre el viaje de la peticion: un token que vence en
   * diez segundos ya no sirve para nada.
   */
  private async token(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data } = await supabase.auth.getSession();
      const sesion = data.session;
      if (!sesion) return null;

      const seguraHasta = (sesion.expires_at ?? 0) - MARGEN_RENOVACION;
      if (seguraHasta > Date.now() / 1000) return sesion.access_token;

      return (await renovarUnaVez()) ?? sesion.access_token;
    } catch {
      return null;
    }
  }

  private async enviar(path: string, options: RequestOptions, token: string | null) {
    return fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Sin esta cabecera la API responde 401: las rutas del dashboard
        // verifican la sesion del lado del servidor, no solo en el navegador.
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: 'no-store'
    });
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let response = await this.enviar(path, options, await this.token());

    /**
     * Segunda oportunidad ante un 401.
     *
     * Mirar la caducidad antes de enviar cubre casi todo, pero no todo: el
     * reloj del navegador puede ir adelantado, o la sesion pudo renovarse en
     * otra pestaña mientras esta peticion volaba. En esos casos el token es
     * recuperable y rendirse a la primera obligaria a volver a escribir la
     * contraseña por nada.
     *
     * Se reintenta UNA vez y solo tras renovar de verdad. Un reintento en
     * bucle contra un servidor que dice 401 es una forma elegante de
     * tumbarse solo.
     */
    if (response.status === 401 && isSupabaseConfigured) {
      const fresco = await renovarUnaVez();
      if (fresco) response = await this.enviar(path, options, fresco);
    }

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success) {
      /**
       * Un 401 solo significa "vuelve a entrar" si de verdad no hay sesion.
       *
       * Antes CUALQUIER 401 se traducia a "Tu sesion expiro", y eso escondio
       * durante semanas que el panel de pruebas apuntaba al webhook de Meta:
       * la ruta rechazaba por falta de FIRMA, el dashboard decia "sesion
       * expirada", y buscar el fallo en la autenticacion no llevaba a ningun
       * lado. Cuando hay token y aun asi rebota, el problema es otro y lo
       * cuenta el servidor.
       */
      if (response.status === 401) {
        const seguimosConSesion = Boolean((await this.token()) && isSupabaseConfigured);
        throw new Error(
          seguimosConSesion
            ? formatErrorMessage(payload)
            : 'Tu sesion expiro. Vuelve a entrar.'
        );
      }
      throw new Error(formatErrorMessage(payload));
    }

    return payload.data as T;
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { signal });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body });
  }
}

export const api = new ApiClient(API_URL);
