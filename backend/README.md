# Pollito Backend

Backend REST para una distribuidora avicola que vende productos por kilogramo. Esta primera version cubre productos, clientes, pedidos, detalles, inventario, configuracion, health check y deja preparados los modulos de WhatsApp e IA con Groq.

## Tecnologias

- Node.js
- TypeScript
- Express
- Supabase JS SDK
- PostgreSQL en Supabase
- Zod
- dotenv
- cors
- helmet
- morgan
- tsx

## Instalacion

```bash
npm install
```

## Variables de entorno

Crea tu archivo local:

```bash
cp .env.example .env
```

Variables necesarias:

```env
NODE_ENV=development
PORT=4000

SUPABASE_URL=
SUPABASE_SECRET_KEY=

FRONTEND_URL=http://localhost:3000

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

`SUPABASE_SECRET_KEY` solo debe vivir en backend. El frontend debe usar una publishable key, nunca esta secret key.

## Scripts

Desarrollo:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Produccion:

```bash
npm start
```

Lint y formato:

```bash
npm run lint
npm run format
```

## Endpoints

Base URL: `/api`

- `GET /api/health`
- `GET /api/productos`
- `GET /api/productos/:id`
- `POST /api/productos`
- `PATCH /api/productos/:id`
- `PATCH /api/productos/:id/activar`
- `PATCH /api/productos/:id/desactivar`
- `GET /api/clientes`
- `GET /api/clientes/:id`
- `POST /api/clientes`
- `PATCH /api/clientes/:id`
- `GET /api/pedidos`
- `GET /api/pedidos/:id`
- `POST /api/pedidos`
- `PATCH /api/pedidos/:id`
- `PATCH /api/pedidos/:id/estado`
- `GET /api/inventario/movimientos`
- `POST /api/inventario/movimientos`
- `GET /api/inventario/resumen`
- `GET /api/configuracion`
- `PATCH /api/configuracion/:id`
- `POST /api/whatsapp/webhook`
- `POST /api/ai/extract-order`

## Ejemplos JSON

Crear producto:

```json
{
  "nombre": "Pechuga",
  "categoria": "pollo",
  "precio_kg": 95,
  "stock_actual": 120,
  "stock_minimo": 20
}
```

Crear cliente:

```json
{
  "nombre": "Restaurante El Centro",
  "telefono": "4421234567",
  "direccion": "Av. Principal 123",
  "notas": "Entrega por la manana"
}
```

Crear pedido:

```json
{
  "cliente": {
    "nombre": "Restaurante El Centro",
    "telefono": "4421234567",
    "direccion": "Av. Principal 123"
  },
  "fecha_entrega": "2026-05-25",
  "origen": "dashboard",
  "notas": "Separar en bolsas de 5 kg",
  "productos": [
    {
      "producto_id": "00000000-0000-0000-0000-000000000000",
      "kg": 20
    }
  ]
}
```

Cambiar estado de pedido:

```json
{
  "estado": "confirmado"
}
```

Registrar movimiento de inventario:

```json
{
  "producto_id": "00000000-0000-0000-0000-000000000000",
  "tipo": "entrada",
  "cantidad_kg": 50,
  "motivo": "Compra a proveedor"
}
```

Webhook WhatsApp preparado:

```json
{
  "telefono": "4421234567",
  "mensaje": "Quiero 20 kg de pechuga para manana"
}
```

Probar IA:

```json
{
  "message": "Quiero 20 kg de pechuga y 10 kg de ala para el lunes",
  "phone": "4421234567"
}
```

## Arquitectura

El proyecto usa arquitectura modular:

- `config`: variables de entorno y CORS.
- `database`: cliente Supabase centralizado.
- `shared`: errores, respuestas, validacion y utilidades reutilizables.
- `modules`: cada dominio tiene routes, controller, service, schemas y types.
- `routes`: registro central de rutas bajo `/api`.

Los controllers reciben request/response. Las reglas de negocio viven en services.

## Reglas de negocio importantes

La IA no decide reglas de negocio. El modulo `ai` solo extrae datos del mensaje y devuelve JSON estructurado. El backend calcula precios, valida productos, valida clientes, aplica configuracion y decide advertencias.

Al crear pedidos:

- Se busca o crea cliente por `cliente.id` o `telefono`.
- Se validan productos activos.
- Se usa `precio_kg` actual desde Supabase.
- Se calcula `subtotal`, `total_kg` y `total_precio`.
- Se consulta `configuracion_empresa`.
- Si `total_kg` supera `kg_limite_rapido`, se devuelve warning de mayoreo.
- Si la `fecha_entrega` no cumple `dias_preparacion_mayoreo`, se devuelve warning.
- Para MVP el pedido se guarda como `pendiente`, no se bloquea por fecha cercana.

Inventario:

- Crear pedido pendiente no descuenta stock.
- Al pasar un pedido a `confirmado`, se crean movimientos tipo `venta` por cada detalle.
- Se evita duplicar ventas verificando movimientos existentes con `pedido_id`.
- Si no hay stock suficiente, el backend devuelve warning pero no bloquea.
- `entrada` aumenta `stock_actual`.
- `venta` disminuye `stock_actual`.
- `merma` disminuye `stock_actual`.
- `ajuste` suma positivamente a `stock_actual` para esta version MVP.

## Pruebas manuales con curl

Health:

```bash
curl http://localhost:4000/api/health
```

Listar productos:

```bash
curl http://localhost:4000/api/productos
```

Crear producto:

```bash
curl -X POST http://localhost:4000/api/productos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pechuga","categoria":"pollo","precio_kg":95,"stock_actual":120,"stock_minimo":20}'
```

Crear cliente:

```bash
curl -X POST http://localhost:4000/api/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Restaurante El Centro","telefono":"4421234567","direccion":"Av. Principal 123"}'
```

Crear pedido:

```bash
curl -X POST http://localhost:4000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"cliente":{"nombre":"Restaurante El Centro","telefono":"4421234567"},"fecha_entrega":"2026-05-25","origen":"dashboard","productos":[{"producto_id":"REEMPLAZA_PRODUCTO_ID","kg":20}]}'
```

Cambiar estado:

```bash
curl -X PATCH http://localhost:4000/api/pedidos/REEMPLAZA_PEDIDO_ID/estado \
  -H "Content-Type: application/json" \
  -d '{"estado":"confirmado"}'
```

Registrar inventario:

```bash
curl -X POST http://localhost:4000/api/inventario/movimientos \
  -H "Content-Type: application/json" \
  -d '{"producto_id":"REEMPLAZA_PRODUCTO_ID","tipo":"entrada","cantidad_kg":50,"motivo":"Compra a proveedor"}'
```

Resumen de inventario:

```bash
curl http://localhost:4000/api/inventario/resumen
```

Editar configuracion:

```bash
curl -X PATCH http://localhost:4000/api/configuracion/REEMPLAZA_CONFIG_ID \
  -H "Content-Type: application/json" \
  -d '{"kg_limite_rapido":50,"dias_preparacion_mayoreo":3,"horario_apertura":"08:00","horario_cierre":"18:00"}'
```

Webhook WhatsApp:

```bash
curl -X POST http://localhost:4000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"telefono":"4421234567","mensaje":"Quiero 20 kg de pechuga para manana"}'
```

IA:

```bash
curl -X POST http://localhost:4000/api/ai/extract-order \
  -H "Content-Type: application/json" \
  -d '{"message":"Quiero 20 kg de pechuga y 10 kg de ala para el lunes","phone":"4421234567"}'
```

## Siguientes integraciones

- Frontend React/Next.js con publishable key.
- Autenticacion admin.
- WhatsApp real con Baileys o Meta WhatsApp Cloud API.
- Groq real agregando `GROQ_API_KEY`.
- Dashboard administrativo.
