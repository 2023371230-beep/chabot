import { api } from './api-client';
import type {
  ChatPausado,
  ConversacionResumen,
  MensajeChat,
  Cliente,
  ConfiguracionEmpresa,
  InventarioMovimiento,
  InventarioResumen,
  Pedido,
  Producto
} from '@/types/models';

export const endpoints = {
  health: () => api.get<{ timestamp?: string }>('/health'),
  productos: {
    list: () => api.get<Producto[]>('/productos'),
    create: (body: unknown) => api.post<Producto>('/productos', body),
    update: (id: string, body: unknown) => api.patch<Producto>(`/productos/${id}`, body),
    activar: (id: string) => api.patch<Producto>(`/productos/${id}/activar`, {}),
    desactivar: (id: string) => api.patch<Producto>(`/productos/${id}/desactivar`, {})
  },
  clientes: {
    list: () => api.get<Cliente[]>('/clientes'),
    create: (body: unknown) => api.post<Cliente>('/clientes', body),
    update: (id: string, body: unknown) => api.patch<Cliente>(`/clientes/${id}`, body)
  },
  pedidos: {
    list: () => api.get<Pedido[]>('/pedidos'),
    get: (id: string) => api.get<Pedido>(`/pedidos/${id}`),
    create: (body: unknown) =>
      api.post<{ pedido: Pedido; warnings: string[]; requiere_mayoreo: boolean }>(
        '/pedidos',
        body
      ),
    update: (id: string, body: unknown) =>
      api.patch<{ pedido: Pedido; warnings: string[] }>(`/pedidos/${id}`, body),
    // El hilo de WhatsApp que produjo el pedido. Vacio = lo capturo una persona.
    conversacion: (id: string) => api.get<MensajeChat[]>(`/pedidos/${id}/conversacion`),
    updateStatus: (id: string, estado: string) =>
      api.patch<{ pedido: Pedido; warnings: string[] }>(`/pedidos/${id}/estado`, {
        estado
      })
  },
  inventario: {
    resumen: () => api.get<InventarioResumen[]>('/inventario/resumen'),
    movimientos: () => api.get<InventarioMovimiento[]>('/inventario/movimientos'),
    createMovimiento: (body: unknown) =>
      api.post<InventarioMovimiento>('/inventario/movimientos', body)
  },
  configuracion: {
    get: () => api.get<ConfiguracionEmpresa>('/configuracion'),
    update: (id: string, body: unknown) =>
      api.patch<ConfiguracionEmpresa>(`/configuracion/${id}`, body)
  },
  whatsapp: {
    webhook: (body: unknown) => api.post<unknown>('/whatsapp/webhook', body),
    // Chats donde el asistente se detuvo y esperan a una persona.
    handoffs: () =>
      api.get<{ total: number; chats: ChatPausado[] }>('/whatsapp/handoffs'),
    // Una linea por telefono para la bandeja.
    conversaciones: () => api.get<ConversacionResumen[]>('/whatsapp/conversaciones'),
    // El hilo completo de un telefono.
    conversacion: (telefono: string) =>
      api.get<MensajeChat[]>(`/whatsapp/conversaciones/${encodeURIComponent(telefono)}`),
    reanudar: (telefono: string) =>
      api.post<{ telefono: string; reanudado: boolean }>(
        `/whatsapp/handoffs/${encodeURIComponent(telefono)}/reanudar`,
        {}
      )
  },
  ai: {
    extractOrder: (body: unknown) => api.post<unknown>('/ai/extract-order', body)
  }
};
