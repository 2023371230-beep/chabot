import type { ApiResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: 'no-store'
    });

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message ?? 'No se pudo completar la solicitud');
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

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
