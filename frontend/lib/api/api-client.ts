import { isSupabaseConfigured, supabase } from '@/lib/supabase/supabase-client';
import type { ApiResponse } from '@/types/api';

/**
 * Las rutas viven en este mismo proyecto de Next (`app/api/**`), asi que por
 * defecto se habla en relativo: el mismo codigo funciona en localhost y en
 * Vercel sin cambiar nada al desplegar.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

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
   * Token de la sesion actual.
   *
   * Se pide a Supabase en cada peticion en vez de guardarlo en una variable:
   * `getSession` devuelve el token vigente y lo renueva solo cuando esta a
   * punto de vencer. Con una copia en memoria, la primera peticion despues de
   * una hora saldria con un token caducado y devolveria 401 sin motivo
   * aparente.
   */
  private async token(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await this.token();

    const response = await fetch(`${this.baseUrl}${path}`, {
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

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success) {
      // Una sesion vencida se nombra por lo que es. El mensaje generico de la
      // API ("Sesion requerida") no le dice al usuario que tiene que hacer.
      if (response.status === 401) {
        throw new Error('Tu sesion expiro. Vuelve a entrar.');
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
