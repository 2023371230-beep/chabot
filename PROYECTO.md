# 🐥 Báscula — Documentación del proyecto

> **Documentos hermanos**
> [DESPLIEGUE.md](DESPLIEGUE.md) — subirlo a Vercel paso a paso
> [LOGIN.md](LOGIN.md) — crear tu usuario y encender la autenticación
> [SEGURIDAD.md](SEGURIDAD.md) — qué se cerró, qué queda abierto y por qué
> [AUDITORIA-UI.md](AUDITORIA-UI.md) — qué se revisó de la interfaz y qué falla
> [MEJORAS-UI.md](MEJORAS-UI.md) — qué funciona pero cuesta, y qué cambiaría

> Sistema de pedidos para una distribuidora avícola, con dashboard web y
> chatbot de WhatsApp.
>
> **Este documento es la memoria del proyecto.** Está escrito para que
> cualquiera (persona o IA sin contexto previo) pueda retomar el trabajo sin
> tener que redescubrir las decisiones ni volver a tropezar con las trampas
> que ya se encontraron.

Última actualización: 5 de septiembre de 2026

---

## 1. Qué es y para quién

Una distribuidora avícola mexicana que vende pollo **por kilogramo**. Un solo
usuario real: el dueño/encargado. No es técnico, usa el sistema todos los días
con prisa, a veces desde el celular.

Los pedidos llegan por dos vías:
- **WhatsApp** — un cliente escribe "quiero 20 kilos de pechuga para el viernes"
- **Dashboard** — el dueño los captura a mano

### Las reglas de negocio que gobiernan todo

1. **Crear un pedido NO toca el stock.** Nace en estado `pendiente`.
2. **Solo confirmar descuenta el stock.** Es el único botón que mueve inventario.
3. **Cancelar un pedido confirmado NO regresa el stock.** Verificado en
   `pedidos.service.ts`: no existe lógica de reversión. Si se confirmó por
   error, hay que corregirlo a mano con un movimiento de ajuste.
4. **Mayoreo = más de 50 kg** (configurable) y requiere **2 días** de
   preparación (configurable).

La regla 3 es la más peligrosa y la razón de que confirmar tenga un diálogo
que nombra la consecuencia.

---

## 2. Arquitectura

**Una sola app de Next.js.** El backend de Express se retiró: sus servicios
viven ahora dentro del mismo proyecto y se exponen como rutas de la API. Eso es
lo que permite desplegar todo en Vercel con un `git push` (ver
[DESPLIEGUE.md](DESPLIEGUE.md)).

```
Pollito/
├── sql/
│   ├── 001_schema_completo.sql      el esquema, listo para pegar
│   ├── 002_estado_serverless.sql    presupuesto de IA compartido
│   └── README.md                    justificación de cada decisión
│
├── frontend/         Next.js 14 App Router, puerto 3000 — TODA la app
│   ├── server/       el antiguo backend: NO se importa desde el navegador
│   │   ├── config/env.ts          variables de entorno centralizadas
│   │   ├── database/              cliente de Supabase (service_role)
│   │   ├── http/route.ts          sobre de respuesta + errores → HTTP
│   │   ├── modules/               un módulo por dominio
│   │   │   ├── ai/                extracción con Groq
│   │   │   ├── clientes/
│   │   │   ├── configuracion/
│   │   │   ├── inventario/
│   │   │   ├── pedidos/
│   │   │   ├── productos/
│   │   │   └── whatsapp/
│   │   │       ├── whatsapp.intents.ts      reglas SIN IA (el filtro)
│   │   │       ├── whatsapp.matcher.ts      nombre de corte → UUID, fechas
│   │   │       ├── whatsapp.memoria.ts      memoria corta (en la base)
│   │   │       ├── whatsapp.presupuesto.ts  racionamiento de la cuota de IA
│   │   │       ├── whatsapp.handoff.ts      apagado controlado del bot
│   │   │       └── whatsapp.service.ts      orquesta todo
│   │   └── shared/                errores y utilidades
│   ├── scripts/                   simuladores (`npm run simular`)
│   ├── app/api/                   las rutas: un route.ts por endpoint
│   ├── app/          una carpeta por ruta
│   ├── components/
│   │   ├── icons/    set propio de 30 iconos SVG
│   │   ├── layout/   AppShell, PageShell, TopNavbar
│   │   ├── motion/   primitivas de framer-motion
│   │   ├── shared/   DataTable, EmptyState, ConfirmDialog...
│   │   └── ui/       Button, Card, Input, Field, Dialog...
│   ├── features/     lógica por dominio
│   └── lib/          api-client, formatters, constants
│
└── docs/ui/
    ├── copy.md            ~220 textos auditados y reescritos (SIN APLICAR)
    └── design-system.md   dirección visual anterior (histórica)
```

Cada módulo de `server/` es `service.ts` + `schemas.ts` (Zod) + `types.ts`.
Los antiguos `controller.ts` y `routes.ts` de Express desaparecieron: su
trabajo lo hace ahora `app/api/**/route.ts`, que valida con el MISMO esquema de
Zod y llama al MISMO servicio.

**El frontend NO habla con Supabase para datos.** Solo lo usa para
`auth.signInWithPassword`. Todo lo demás pasa por `app/api/**` con la
`service_role`. Esto es lo que permite cerrar RLS por completo.

---

## 3. Estado actual — qué funciona (verificado)

### ✅ Base de datos

Esquema completo aplicado en Supabase. Probado contra PostgreSQL 15 en Docker
antes de aplicarlo.

**9 tablas:** `configuracion_empresa`, `productos`, `clientes`, `pedidos`,
`pedido_detalles`, `inventario_movimientos`, `conversaciones_whatsapp`,
`mensajes_whatsapp`, `auditoria`.

Pruebas que pasaron:
- `confirmar_pedido` descuenta stock correctamente
- Llamarla dos veces **no** duplica el descuento
- Con stock insuficiente reporta **todos** los faltantes y no toca nada
- `anon` (la clave pública del navegador) lee **0 filas** y no puede escribir
- Re-ejecutar el script completo no duplica ni pierde datos

### ✅ Dashboard

Las 7 pantallas cargan datos reales de Supabase: Inicio, Pedidos, Productos,
Clientes, Inventario, Reportes, Configuración.

Flujo probado de punta a punta: crear pedido → confirmar → stock baja de
100 a 80 kg → se registra el movimiento de inventario.

### ✅ Groq (IA)

Funciona. Probado con un mensaje real:

> Entrada: *"buenas, me mandas 20 kilos de pechuga y 5 de pierna para el viernes"*
> Salida: `{"intent":"pedido","productos":[{"nombre_producto":"pechuga","kg":20},{"nombre_producto":"pierna","kg":5}],"fecha_entrega":"viernes"}`

### ✅ Webhook de WhatsApp (pasos 3-7)

| Qué | Resultado medido |
|---|---|
| `GET /webhook` con token correcto | Devuelve `hub.challenge` en `text/plain` |
| `GET /webhook` con token incorrecto | 403 |
| `POST /webhook` | **200 en 18 ms** |
| Mismo `wamid` dos veces | Queda **1 solo** mensaje |
| Payload basura | 200 (no 400, que causaría reintentos en bucle) |
| Solo `statuses` | No crea nada |

### ✅ Filtro de intenciones y racionamiento de IA

El cuello de botella real de Groq, medido contra las cabeceras de la API:

```
x-ratelimit-limit-requests: 1000    por día
x-ratelimit-limit-tokens:   8000    por MINUTO
```

No hay recarga mensual. El límite por minuto es el que duele: lo revienta un
solo cliente mandando diez mensajes seguidos, y durante ese minuto el bot deja
de funcionar **para todos**.

Contra eso hay cuatro capas, en orden:

| Capa | Qué corta | Dónde |
|---|---|---|
| Clasificador por reglas | Cortesía, catálogo, horario, precio, cancelaciones, quejas, estado de pedido, basura | `whatsapp.intents.ts` |
| Memoria corta | Texto reenviado, cotización confirmada, respuesta a "¿cuántos kilos?" | `whatsapp.memoria.ts` |
| Presupuesto | 900/día, 15/minuto, 20 por teléfono por hora | `whatsapp.presupuesto.ts` |
| Recorte | Mensajes > 400 caracteres se truncan; > 700 no llegan a la IA | `whatsapp.intents.ts` |

Medido con los simuladores:

| Prueba | Resultado |
|---|---|
| 52 escenarios reales | **52 correctos, 0 peticiones desperdiciadas** (antes: 30 correctos, 20 desperdiciadas) |
| 19 revisiones de conversación | **19 pasadas** |
| Conversación real de 12 mensajes que termina en pedido | **1 sola petición de IA** |
| `GET /api/health` | expone `ia.restantesHoy` para ver la cuota bajando |

Se re-corren con:

```bash
cd frontend && npm run simular && npm run simular:conversaciones
```

---

## 4. Qué falta — en orden

### 🔴 Paso 8 — Conectar el flujo completo del bot

Es lo único que separa esto de "funciona de verdad". Hoy el bot contesta
*"Recibí tu mensaje, ya casi puedo tomarte el pedido"*.

Falta encadenar, en `whatsapp.service.ts` → `procesarMensaje`:

1. Llamar a `aiService` para extraer el pedido (ya funciona por separado)
2. Buscar los productos por nombre contra Supabase — la IA devuelve
   `"pechuga"` y hay que resolverlo al UUID del producto
3. Aplicar reglas: stock disponible, límite de mayoreo, días de preparación
4. Crear/encontrar el cliente por teléfono
5. Crear el pedido en estado `pendiente`
6. Responder al cliente con el resumen y el total

Se puede desarrollar y probar **sin token de WhatsApp** usando el simulador:

```bash
curl -X POST http://localhost:4000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"telefono":"527352233942","mensaje":"quiero 20 kilos de pechuga"}'
```

También hay que decidir cómo manejar conversaciones de varios turnos. La tabla
`conversaciones_whatsapp` ya existe con su campo `contexto` (JSONB) y su
máquina de estados, pero **nadie la usa todavía**.

### ✅ Autenticación de la API (hecha)

**17 rutas exigen sesión.** El token de Supabase se verifica del lado del
servidor antes de tocar la base. Quedan abiertas `/api/health` y el webhook de
Meta, las dos con cuota por IP.

Verificado con `npm run probar:seguridad`: 14 de 14. Sin token → 401; con token
válido → 200; con la firma alterada → 401; un token forjado con `alg: none` →
401. Detalle completo en [SEGURIDAD.md](SEGURIDAD.md).

**Lo que sigue pendiente de seguridad:** la sesión vive en `localStorage`, así
que un XSS la expone. La CSP lo mitiga; la solución de fondo es pasarla a
cookies `HttpOnly` con `@supabase/ssr`.

### 🟡 Backend no aprovecha el esquema nuevo

Dos cosas quedaron a medias cuando se rediseñó la base:

1. **Soft delete no se filtra.** Las tablas tienen `deleted_at` pero
   **0 de 6** services filtran por él. Un registro "borrado" seguiría
   apareciendo. Falta agregar `.is('deleted_at', null)` a las consultas.

2. **`confirmar_pedido` no se usa.** La función SQL atómica existe y está
   probada, pero `pedidos.service.ts` sigue descontando inventario con varias
   queries sueltas en JavaScript. Reemplazar por:
   ```ts
   const { data } = await supabase.rpc('confirmar_pedido', { p_pedido_id: id });
   ```

### 🟡 `costo_kg` no existe

Sin él, Reportes solo puede mostrar **ingresos**, nunca **ganancia**. Requiere:
- `ALTER TABLE productos ADD COLUMN costo_kg numeric(10,2) DEFAULT 0;`
- Copiarlo a `pedido_detalles` al crear el pedido (igual que `precio_kg`, para
  que los pedidos viejos conserven el costo del momento)
- Añadirlo al formulario de producto y a los cálculos de Reportes

### ✅ Migración a Next.js API Routes (hecha)

Express se retiró. Los 20 endpoints viven en `frontend/app/api/**/route.ts` y
llaman a los mismos servicios, validando con los mismos esquemas de Zod. Ver
[DESPLIEGUE.md](DESPLIEGUE.md).

Falta un paso manual: **aplicar `sql/002_estado_serverless.sql` en Supabase.**
Sin él el bot funciona pero sin presupuesto de IA, y el síntoma es silencioso.

### 🟢 Cosas menores

- **Login desactivado.** `NEXT_PUBLIC_DISABLE_AUTH=true` en
  `frontend/.env.local`. No existe usuario admin en Supabase Auth. Para
  reactivarlo: crear el usuario (Authentication → Users → Add user, con
  **Auto Confirm** marcado) y quitar la variable.
- **Datos de prueba en Supabase:** 4 clientes y 4 pedidos con nombres `PRUEBA`.
- **`docs/ui/copy.md`** tiene ~220 textos reescritos que nunca se aplicaron.
- **`backend/sql/confirm_order_transaction.sql`** quedó obsoleto, lo reemplaza
  `confirmar_pedido` dentro del esquema nuevo.
- Formulario de **Configuración** es el único que no usa el sistema de `Field`.

---

## 5. Trampas descubiertas — no volver a tropezar

Estas costaron tiempo. Están documentadas para no repetirlas.

### El modelo de Groq caducó sin aviso

`llama-3.1-8b-instant` fue dado de baja. La API responde
*"The model does not exist or you do not have access to it"*. Ahora se usa
`openai/gpt-oss-20b`.

**Si la IA deja de funcionar, lo primero que hay que revisar es si el modelo
sigue existiendo:**
```bash
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

### El webhook NO debe validar con Zod antes de responder

Meta reintenta ante **cualquier** respuesta que no sea 200. Si el payload no
cuadra con el esquema y se devuelve 400, Meta reintenta el mismo mensaje en
bucle. Por eso `POST /webhook` responde 200 siempre y valida después.

### `messages` y `statuses` llegan por el mismo webhook

Meta manda los acuses de entrega (*sent/delivered/read*) al mismo endpoint que
los mensajes entrantes. Si se tratan igual, **el bot se responde a sí mismo en
bucle infinito**. `esSoloEstados()` en `whatsapp.types.ts` los separa.

### El insert va ANTES de procesar

La restricción `UNIQUE` sobre `wa_message_id` es lo que corta los reintentos.
Si se procesara primero, un reintento crearía el pedido dos veces aunque el
insert fallara después.

### El token temporal de Meta dura 24 horas

El de la pantalla "Enviar y recibir mensajes" expira en un día. Hay que generar
un **System User Token** en Business Settings, que no expira.

### `tailwind-merge` se come clases de ancho de borde personalizadas

`border-ink` (definido como `borderWidth: {ink: '2px'}`) desaparecía al
combinarse con `border-foreground` porque `cn()` usa `twMerge` y las trata como
conflictivas. Solución: usar los anchos estándar de Tailwind (`border`,
`border-2`) y reservar los nombres personalizados solo para colores.

### Tailwind necesita reinicio al cambiar la config

Varias veces las clases nuevas (`bg-bar`, `text-on-danger`, `rounded-md`)
existían en el DOM pero **el CSS no se generaba**. El dev server de Next se
queda con la config vieja. Al cambiar `tailwind.config.ts`:
```bash
rm -rf frontend/.next/cache   # y reiniciar el dev server
```

### `@apply font-display` no funciona

Choca con el descriptor CSS `font-display` de `@font-face`. Hay que escribir
`font-family: var(--font-display)` en CSS plano.

### Radix no desmonta el diálogo si la animación no termina

Las clases `data-[state=closed]:animate-out` de `tailwindcss-animate` sin
keyframes de salida dejaban el diálogo montado para siempre: se abría y no
cerraba nunca. Se quitaron.

### `DialogTitle` tiene que ser el primitivo de Radix

Un `<h2>` normal se ve igual pero deja el diálogo **mudo** para lectores de
pantalla: es `DialogPrimitive.Title` el que conecta `aria-labelledby`.

### Los GRANT a `service_role` se hacen explícitos

Descubierto probando el esquema en PostgreSQL real: sin ellos el backend truena
con *"permission denied for table productos"*, un error que parece de RLS pero
es de `GRANT`. El script los concede tabla por tabla.

### La vista materializada no soporta RLS

`resumen_dashboard` necesita un `REVOKE` explícito para `anon`/`authenticated`,
porque Supabase concede privilegios por defecto a las relaciones nuevas de
`public`. Es el único objeto del esquema que hay que cerrar a mano.

### La IA entiende "cancela mi pedido de 20 kilos" como un pedido de 20 kilos

La trampa más cara de todas. El modelo ve *"20 kilos de pechuga"*, devuelve
`intent: "pedido"` y el sistema **crea un pedido nuevo**. El cliente pidió
cancelar y termina con el doble. Lo mismo pasa con *"mejor que sean 30 y no
20"*, que crea un segundo pedido encima del primero.

Por eso cancelaciones, modificaciones, quejas y confirmaciones se atajan con
reglas **antes** de la IA. **El orden de las reglas en `whatsapp.intents.ts` es
la regla**: se evalúa de más peligroso a más inocente, y una queja que menciona
kilos sigue siendo una queja.

### Un `` en una alternancia no aplica a todos los términos

`/quiero|necesito|apartame/` sólo pone el límite de palabra en el primero
y el último. Así, `apartame` hacía match dentro de **"apartamelo"**, y por eso
*"si, apartamelo"* se clasificaba como pedido nuevo en vez de confirmación.
La forma correcta es agrupar: `/(?:quiero|necesito|apartame)/`.

### La deduplicación por `wa_message_id` no cubre el reenvío

Si el cliente no ve la palomita y reescribe su pedido, ese es un mensaje nuevo
de verdad, con id distinto: la restricción `UNIQUE` no lo detiene y se crean
dos pedidos. Hacen falta otras dos redes, ambas en `whatsapp.memoria.ts`:
caché del texto idéntico (3 min) y huella de los renglones ya resueltos
(10 min), que agarra el caso de reescribirlo con otras palabras.

### El bot no puede preguntar lo que no sabe oír

`"Se lo aparto?"` y `"¿Cuántos kilos?"` son preguntas, y WhatsApp no tiene
sesión: el `"si porfa"` o el `"20"` que contesta el cliente llegan solos, sin
nada del mensaje anterior. Sin memoria corta el bot respondía *"no alcancé a
identificar el pedido"* a alguien que acababa de contestar exactamente lo que
se le preguntó. Guardar la cotización además **ahorra** la petición: el "sí" se
convierte en pedido con los renglones que ya estaban resueltos.

### `REFRESH MATERIALIZED VIEW CONCURRENTLY` no corre dentro de una función

PostgreSQL lo prohíbe: toda función corre dentro de una transacción. Por eso
`refrescar_resumen_dashboard()` usa el refresco no concurrente.

---

## 6. Decisiones de diseño y por qué

### Base de datos

- **`pedido_detalles`, no `detalle_pedidos`.** El backend usa el embed de
  PostgREST `.select('*, clientes(*), pedido_detalles(*, productos(*))')`, que
  resuelve nombres contra las FK reales. Renombrar rompe todas las consultas.
- **`precio_kg` se copia en el detalle.** Si sube el precio del pollo, los
  pedidos viejos deben conservar el precio al que se vendieron.
- **`horario_apertura` es TEXT, no TIME.** El backend valida `HH:MM` con regex;
  un `TIME` sale como `'08:00:00'` por PostgREST y no pasa esa validación.
- **Todas las columnas de `configuracion_empresa` tienen DEFAULT.** El backend
  hace `.insert({})` sin columnas en el primer arranque.
- **`subtotal` NO es una columna GENERATED.** El backend ya manda `subtotal` en
  el insert y PostgreSQL rechaza inserts explícitos sobre columnas generadas.
  Un trigger lo recalcula.
- **Índices únicos parciales.** Con soft delete, un `UNIQUE` normal impediría
  reusar el teléfono de un cliente borrado.

### Interfaz

- **El shell tiene altura fija.** `body` con `overflow: hidden` y cada región
  scrollea por dentro. Así la pantalla siempre se llena y las barras quedan
  visibles. `min-h-0` en los hijos flex es obligatorio o el scroll interno se
  rompe.
- **Tablas se vuelven fichas abajo de 768px.** Con scroll horizontal los
  botones de acción quedaban fuera de pantalla: no se podía confirmar un pedido
  desde el celular.
- **Intuitivo ≠ explicado.** Se quitaron los textos de ayuda que explicaban lo
  obvio. Si hace falta una frase para entender un control, el control está mal
  hecho. El selector de inventario dice *"Entrada — llegó mercancía"* en la
  opción misma y muestra `80 kg + 1 kg queda en 81 kg` antes de guardar.
- **Productos ≠ Inventario.** Antes ambas pantallas mostraban
  producto/precio/stock. Ahora: **Productos** = qué vendo y cuánto tengo ahora;
  **Inventario** = el historial de movimientos; **Reportes** = los totales.

---

## 7. Credenciales — dónde va cada una

**Todas viven en un solo archivo: `frontend/.env.local`.** Ya no hay dos.
Para Vercel, las mismas se copian en Settings → Environment Variables.

| Variable | De dónde se saca |
|---|---|
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Settings → API Keys → **Secret** |
| `NEXT_PUBLIC_SUPABASE_URL` | La misma URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Settings → API Keys → **Publishable** |
| `GROQ_API_KEY` | console.groq.com/keys |
| `WHATSAPP_ACCESS_TOKEN` | Business Settings → System Users → Generate Token |
| `WHATSAPP_APP_SECRET` | developers.facebook.com → app → Configuración → Básica |
| `WHATSAPP_VERIFY_TOKEN` | **Lo inventas tú.** Debe coincidir con el de Meta |
| `WHATSAPP_ALERTA_NUMERO` | **Tu celular**, con lada y sin el `+` |

⚠️ La `SECRET` nunca va en una variable `NEXT_PUBLIC_*`: acabaría en el bundle
del navegador.

Los `.env` están en `.gitignore`. Los `.env.example` documentan la estructura
sin valores.

**Proyecto de Supabase:** `zbukglthlybwbeevbozv`
**Número de prueba de Meta:** `+1 555 658 1499` (ID `1136604552871585`)
**WABA ID:** `3690061967802341`

---

## 8. Cómo correrlo

```bash
cd frontend && npm run dev
```

Un solo comando: la app y su API son el mismo proyecto (puerto 3000).

### Verificar que todo responde

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/productos
```

`/api/health` devuelve además la cuota de IA que queda hoy.

### Los simuladores

```bash
cd frontend
npm run simular                 # 67 escenarios contra las reglas, sin red
npm run simular:conversaciones  # memoria y presupuesto contra la base
npm run probar:handoff          # apagado controlado (manda alertas reales)
npm run simular:real            # conversación completa con IA de verdad
node scripts/probar-webhook.js  # el webhook por HTTP, con firma
npm run limpiar:pruebas         # borra lo que dejaron los anteriores
```

### Probar el webhook sin Meta

```bash
# verificación (debe devolver TEST123 en texto plano)
curl "http://localhost:4000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=pollito_webhook_2026_a7f3k9&hub.challenge=TEST123"

# simular un mensaje entrante
curl -X POST http://localhost:4000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"telefono":"527352233942","mensaje":"quiero 20 kilos de pechuga"}'
```

### Probar la IA

```bash
curl -X POST http://localhost:4000/api/ai/extract-order \
  -H "Content-Type: application/json" \
  -d '{"message":"me mandas 20 kilos de pechuga para el viernes","phone":"527352233942"}'
```

### Aplicar el esquema en una base nueva

Supabase → SQL Editor → pegar `backend/sql/001_schema_completo.sql` → Run.
Es idempotente: se puede re-ejecutar sin duplicar nada.

---

## 9. Pasos que faltan del plan de WhatsApp

Los pasos 3 al 7 ya están hechos y probados.

- [ ] **8.** Conectar el flujo: IA → validar productos → reglas → crear pedido
      → responder
- [ ] **9.** ngrok + registrar el webhook en Meta
      (`ngrok http 4000`, luego pegar `<url>/api/whatsapp/webhook` en
      Meta → WhatsApp → Configuration → Webhook, con el verify token)
- [ ] **10.** Prueba de punta a punta desde un WhatsApp real

**Antes del paso 9:** poner `WHATSAPP_APP_SECRET` y cerrar el resto de rutas
del backend. Exponer con ngrok un backend sin autenticación deja que cualquiera
cree y confirme pedidos.
