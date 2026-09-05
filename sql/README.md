# 🐥 Base de datos Pollito — diseño

Esquema completo en [`001_schema_completo.sql`](001_schema_completo.sql).

## Cómo ejecutarlo

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Pegar el contenido completo de `001_schema_completo.sql`
3. **Run**

El script es idempotente: se puede volver a correr sin duplicar datos ni romper nada.

Verificación después de correrlo:

```sql
select * from public.resumen_dashboard;
select nombre, precio_kg, stock_actual from public.productos order by nombre;
select * from public.configuracion_empresa;
```

---

## ✅ Probado contra PostgreSQL 15 real

Ejecutado en un contenedor PostgreSQL 15.19 simulando el entorno de Supabase
(roles `anon`/`authenticated`/`service_role`, esquema `auth`, privilegios por
defecto). Resultados:

| Prueba | Resultado |
|---|---|
| Ejecución completa en base limpia | 0 errores |
| Re-ejecución sobre base con datos | 0 errores, sin duplicar ni perder nada |
| `confirmar_pedido` camino feliz | Stock 100→80 y 100→90, estado `confirmado`, 2 movimientos |
| `confirmar_pedido` llamada 2 veces | Stock intacto, sigue con 2 movimientos |
| Stock insuficiente | Reporta **ambos** faltantes; stock y estado sin tocar |
| Pedido cancelado / inexistente / sin renglones | Error claro, sin efectos |
| Trigger `updated_at` | Avanza solo al hacer UPDATE |
| Trigger `subtotal` | Corrigió un subtotal erróneo (999 → 1900) sin rechazar el insert |
| Auditoría | Registró `pendiente → confirmado` sola |
| Teléfono duplicado | Rechazado por `idx_clientes_telefono_unico` |
| `wa_message_id` repetido | Rechazado con `23505` (webhook a prueba de reintentos) |
| `anon` leyendo tablas | 0 filas |
| `anon` escribiendo | Bloqueado por RLS |
| `anon` leyendo `resumen_dashboard` | Permiso denegado |
| `service_role` leyendo y escribiendo | Funciona |

---

## Las 9 tablas

| Tabla | Para qué sirve |
|---|---|
| `configuracion_empresa` | Reglas del negocio editables: límite de mayoreo, días de preparación, horario |
| `productos` | Catálogo de cortes con precio por kg y stock |
| `clientes` | Identificados por teléfono — es la única llave que tiene el chatbot |
| `pedidos` | Cabecera del pedido: cliente, fecha, estado, totales |
| `pedido_detalles` | Renglones del pedido: qué producto, cuántos kg, a qué precio |
| `inventario_movimientos` | Libro mayor append-only de entradas, ventas, mermas y ajustes |
| `conversaciones_whatsapp` | Estado de la charla en curso con cada número |
| `mensajes_whatsapp` | Bitácora de todos los mensajes, entrantes y salientes |
| `auditoria` | Quién cambió qué y cuándo en las tablas críticas |

## Relaciones

```
clientes ──< pedidos ──< pedido_detalles >── productos
                │                                │
                │                                │
                └──< inventario_movimientos >────┘

clientes ──< conversaciones_whatsapp ──< mensajes_whatsapp
                      │
                      └──> pedidos  (el pedido que se está armando)
```

Reglas de borrado, elegidas para que el historial nunca se rompa:

- `pedidos.cliente_id` → **RESTRICT**. Un cliente con historial no se borra.
- `pedido_detalles.pedido_id` → **CASCADE**. Los renglones no viven sin su pedido.
- `pedido_detalles.producto_id` → **RESTRICT**. Un producto vendido no se borra.
- `inventario_movimientos.pedido_id` → **SET NULL**. Si desaparece el pedido, el movimiento sobrevive: si no, habría stock descontado sin explicación.

---

## Decisiones de diseño y por qué

### El nombre `pedido_detalles` no es negociable

El backend usa el embed de PostgREST:

```ts
.select('*, clientes(*), pedido_detalles(*, productos(*))')
```

PostgREST resuelve esos nombres contra las foreign keys reales. Si la tabla se llamara `detalle_pedidos`, cada consulta de pedidos devolvería error. Mismo caso con `configuracion_empresa`, `inventario_movimientos` y `mensajes_whatsapp`.

### `precio_kg` se copia en el detalle, no se lee del producto

Si mañana sube el precio del pollo, los pedidos de la semana pasada deben seguir mostrando el precio al que realmente se vendieron. Un pedido es una foto del momento en que se hizo.

### NUMERIC en todos lados, nunca FLOAT

Con dinero y con peso, los errores de redondeo binario de `FLOAT` se acumulan y terminan descuadrando el inventario. `kg` usa `NUMERIC(10,3)` (precisión de gramos), el dinero usa `NUMERIC(12,2)`.

### `horario_apertura` es TEXT, no TIME

El backend valida con el regex `^([01]\d|2[0-3]):[0-5]\d$` (formato `HH:MM`). Un `TIME` de PostgreSQL sale como `'08:00:00'` a través de PostgREST, y ese valor **no pasa el regex** al volver a editarlo desde el formulario. Con `TEXT` + `CHECK` el formato es exactamente el que espera el código.

### Todas las columnas de `configuracion_empresa` tienen DEFAULT

El backend hace `.insert({})` sin columnas cuando no encuentra configuración. Si alguna columna fuera `NOT NULL` sin default, ese insert reventaría en el primer arranque.

### `subtotal` no es una columna GENERATED

Lo natural sería `generated always as (kg * precio_kg) stored`. No se puede: el backend ya manda `subtotal` en el insert, y PostgreSQL **rechaza cualquier insert explícito** sobre una columna `GENERATED ALWAYS`. En su lugar hay un trigger `BEFORE INSERT OR UPDATE` que lo recalcula siempre — misma garantía de coherencia, sin romper el código existente.

### `wa_message_id UNIQUE` es la defensa contra pedidos duplicados

Meta **reintenta** el webhook si no recibe un `200` rápido. Sin esa restricción, un reintento crearía el mismo pedido dos veces. Con ella, el segundo insert falla con código `23505` y el backend simplemente lo ignora.

Es la pieza más importante para el patrón "responde rápido, procesa después".

### `confirmado_at` existe para que el dashboard no mienta

"Cuántos pedidos se confirmaron hoy" no se puede responder con `updated_at`, porque `updated_at` cambia por cualquier edición — agregar una nota lo movería y el pedido se contaría como confirmado hoy.

### Los índices únicos son parciales

```sql
create unique index idx_clientes_telefono_unico
  on clientes (telefono) where deleted_at is null;
```

Sin el `where`, un cliente borrado bloquearía para siempre que ese número se vuelva a registrar. Con soft delete, todo índice único tiene que ser parcial.

Además el índice en `clientes.telefono` **es un requisito del código**, no una optimización: el backend usa `.maybeSingle()` al buscar por teléfono, que revienta si encuentra dos filas.

### `auditoria` es la única tabla sin `updated_at` ni `deleted_at`

Deliberado. Un registro de auditoría que se puede editar o borrar no sirve como registro de auditoría. Es append-only, y tampoco tiene foreign keys: debe sobrevivir al borrado del registro original, que es justo cuando más se necesita.

### Conversaciones con estado

Un pedido por WhatsApp casi nunca llega en un solo mensaje:

```
Cliente: "quiero pollo"        → falta cuánto y de qué corte
Bot:     "¿cuántos kg y de qué corte?"
Cliente: "20 de pechuga"       → falta la fecha
Bot:     "¿para qué día?"
Cliente: "el viernes"          → ya se puede armar el pedido
```

`conversaciones_whatsapp.contexto` (JSONB) acumula lo que la IA ya extrajo entre mensajes. `expira_at` cierra conversaciones abandonadas, para que un "sí" mandado tres días después no confirme un pedido viejo.

### `confirmar_pedido` — atómica, idempotente y sin deadlocks

Confirmar un pedido son tres cosas que deben pasar **todas o ninguna**: descontar stock, registrar el movimiento y cambiar el estado. Hacerlo con tres queries sueltas desde el backend deja una ventana donde el stock ya se descontó pero el pedido sigue pendiente.

Tres detalles del diseño:

1. **Todas las validaciones ocurren antes de la primera escritura.** Un `return` de error nunca deja cambios a medias.
2. **Los productos se bloquean ordenados por `id`.** Si dos pedidos comparten productos, ambos los toman en el mismo orden y no se traban entre sí.
3. **Idempotencia doble:** revisa el estado del pedido *y* si ya existen movimientos de venta. Llamarla dos veces nunca descuenta el stock dos veces.

Acumula todos los productos sin stock antes de responder, en vez de reportar solo el primero — así el cliente de WhatsApp recibe un mensaje útil de una sola vez.

### RLS: qué protege de verdad

El frontend **solo** usa Supabase para `auth.signInWithPassword`. Todos los datos pasan por el backend con `service_role`. Por eso se puede cerrar RLS por completo sin romper el dashboard.

Lo que realmente protege: la clave `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es pública y cualquiera la puede sacar del bundle del navegador. Con RLS activo y **sin políticas para `anon`**, esa clave no puede leer ni una fila.

Nota honesta: `service_role` **ignora RLS por diseño** en Supabase. Las políticas `service_role_acceso_total` son defensa en profundidad y documentan la intención, pero no son lo que bloquea al público.

### Los GRANT a `service_role` son explícitos

Esto lo encontró la prueba contra PostgreSQL real. Supabase normalmente concede los privilegios a `service_role` por *privilegios por defecto*, pero si por lo que sea no caen, el backend truena con:

```
permission denied for table productos
```

…y ese error no apunta a la causa: parece problema de RLS cuando en realidad es de `GRANT`. El script los concede explícitamente tabla por tabla. Cuesta nada y elimina la clase de bug completa.

### La vista materializada hay que cerrarla a mano

Las vistas materializadas **no soportan RLS**. Y Supabase concede privilegios por defecto sobre las relaciones nuevas de `public` a `anon`/`authenticated`. Sin este `REVOKE` explícito, `resumen_dashboard` quedaría legible con la clave pública:

```sql
revoke all on public.resumen_dashboard from anon, authenticated;
```

Es el único objeto del esquema que necesita ese paso extra.

### El refresco de la vista es NO concurrente

PostgreSQL prohíbe `REFRESH MATERIALIZED VIEW CONCURRENTLY` dentro de una función — toda función corre dentro de una transacción. Sobre una vista de una sola fila el bloqueo dura milisegundos, así que no es problema.

El backend puede llamar `supabase.rpc('refrescar_resumen_dashboard')` justo después de confirmar un pedido, para que el dashboard no muestre números viejos en el momento en que más importa.

### Zona horaria: "hoy" es hora de México

`current_date` en Supabase es UTC. Entre las 18:00 y la medianoche hora de México, un dashboard en UTC mostraría los pedidos del día siguiente. La vista usa `(now() at time zone 'America/Mexico_City')::date`.

---

## ⚠️ Lo que falta hacer en el backend

El esquema está completo, pero hay tres cosas que el **código** todavía no aprovecha:

### 1. El soft delete no se filtra

Las tablas ya tienen `deleted_at`, pero ningún service filtra por él. Hoy un registro "borrado" seguiría apareciendo en el dashboard. Falta agregar `.is('deleted_at', null)` a las consultas de `clientes.service.ts`, `productos.service.ts`, `pedidos.service.ts` e `inventario.service.ts`.

### 2. `confirmar_pedido` no se usa

`pedidos.service.ts` sigue descontando inventario con varias queries sueltas en JavaScript (`updateOrderStatus` → `inventarioService.createSaleMovementsForOrder`). La función atómica existe pero nadie la llama. Falta reemplazar esa lógica por:

```ts
const { data, error } = await supabase.rpc('confirmar_pedido', { p_pedido_id: id });
```

### 3. `backend/sql/confirm_order_transaction.sql` quedó obsoleto

Es la versión anterior de lo mismo. `confirmar_pedido` la reemplaza (agrega `confirmado_at`, respeta soft delete, ordena los bloqueos para evitar deadlocks y devuelve `{success, error}` en vez de lanzar excepciones). Se puede borrar cuando se migre el backend.
