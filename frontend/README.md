# Pollito Admin Frontend

Dashboard administrativo premium para la distribuidora avicola. Consume el backend REST existente para productos, clientes, pedidos, inventario, configuracion y WhatsApp preparado. Supabase en frontend se usa solo para autenticacion.

## Tecnologias

- Next.js App Router
- React
- TypeScript
- TailwindCSS
- Componentes estilo shadcn/ui
- Radix UI
- lucide-react
- Supabase JS SDK solo para Auth
- React Hook Form
- Zod
- Sonner
- TanStack Table instalado para crecimiento
- Recharts instalado para futuras graficas

## Instalacion

```bash
npm install
```

## Variables de entorno

Crea tu archivo local:

```bash
cp .env.example .env.local
```

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son para Supabase Auth. No uses `SUPABASE_SECRET_KEY` en frontend.

## Correr

```bash
npm run dev
```

## Compilar

```bash
npm run build
```

## Conectar con backend

El backend debe estar corriendo en:

```txt
http://localhost:4000/api
```

Si usas otro puerto, cambia `NEXT_PUBLIC_API_URL`.

## Rutas

- `/login`
- `/dashboard`
- `/pedidos`
- `/pedidos/[id]`
- `/productos`
- `/clientes`
- `/inventario`
- `/configuracion`
- `/whatsapp`

## Autenticacion

El login usa:

```ts
supabase.auth.signInWithPassword;
```

Todas las rutas administrativas pasan por `ProtectedRoute`. Si no hay sesion, redirigen a `/login`. Si ya hay sesion y entras a `/login`, redirige a `/dashboard`.

Para crear un admin, usa Supabase Auth desde el panel de Supabase: Authentication > Users > Add user. Luego inicia sesion con ese email y password.

## Diseno

El layout usa navbar superior centrado, sin sidebar. La paleta combina crema, blanco, negro suave, grises limpios y amarillo pastel como acento. Incluye dark mode con `next-themes`, cards con bordes sutiles, tablas respirables, badges de estado y formularios en dialogs.

## Endpoints consumidos

- `GET /api/health`
- `GET /api/productos`
- `POST /api/productos`
- `PATCH /api/productos/:id`
- `PATCH /api/productos/:id/activar`
- `PATCH /api/productos/:id/desactivar`
- `GET /api/clientes`
- `POST /api/clientes`
- `PATCH /api/clientes/:id`
- `GET /api/pedidos`
- `GET /api/pedidos/:id`
- `POST /api/pedidos`
- `PATCH /api/pedidos/:id/estado`
- `GET /api/inventario/resumen`
- `GET /api/inventario/movimientos`
- `POST /api/inventario/movimientos`
- `GET /api/configuracion`
- `PATCH /api/configuracion/:id`
- `POST /api/whatsapp/webhook`

## Siguiente etapa

- WhatsApp real con Baileys o Meta WhatsApp Cloud API.
- Groq real con `GROQ_API_KEY` en backend.
- Reportes PDF.
- Analytics avanzados.
- Realtime con Supabase.
- Forecasting de demanda.
