# Desplegar Báscula en Vercel

Todo el proyecto es **una sola app de Next.js**. El backend de Express ya no
existe: sus servicios viven en `frontend/server/` y se exponen como rutas en
`frontend/app/api/**/route.ts`.

---

## 1. Antes de desplegar: aplicar el SQL nuevo

En **Supabase → SQL Editor**, pega y ejecuta `sql/002_estado_serverless.sql`.

Sin esto el bot funciona, pero **sin presupuesto de IA**: cada instancia de
Vercel contaría por su cuenta y entre todas se pasarían de las 1000 peticiones
diarias de Groq sin enterarse. El código lo detecta y deja pasar en vez de
bloquear, así que el síntoma es silencioso.

Para comprobar que quedó:

```bash
cd frontend && npm run simular:conversaciones
```

Debe decir **22 pasadas, 0 fallidas**. Si dice 20 y 2, falta el SQL.

---

## 2. Importar el repo en Vercel

En [vercel.com/new](https://vercel.com/new), importa el repositorio y cambia
**una sola cosa**:

| Campo | Valor |
|---|---|
| **Root Directory** | `frontend` |

El resto se detecta solo (Next.js, `npm run build`). Si dejas la raíz del repo,
el build falla porque ahí no hay `package.json`.

---

## 3. Variables de entorno en Vercel

**Settings → Environment Variables.** Son las mismas de `frontend/.env.local`.
Cópialas de ahí — abajo está el porqué de cada una.

### Públicas (viajan al navegador)

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La llave **pública** (anon). Nunca la secreta |

`NEXT_PUBLIC_API_URL` **no se pone**: por defecto es `/api`, que apunta a este
mismo proyecto y funciona igual en local y en producción.

### Secretas (solo se leen en el servidor)

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | La misma URL |
| `SUPABASE_SECRET_KEY` | La **service role**. Es la que salta RLS: si se filtra, se filtra todo |
| `GROQ_API_KEY` | Tu llave de Groq |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `WHATSAPP_ACCESS_TOKEN` | Token de la Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | `1136604552871585` |
| `WHATSAPP_WABA_ID` | `3690061967802341` |
| `WHATSAPP_API_VERSION` | `v25.0` |
| `WHATSAPP_VERIFY_TOKEN` | El que escribes también en Meta |
| `WHATSAPP_APP_SECRET` | Con esto se verifica la firma del webhook |
| `WHATSAPP_ALERTA_NUMERO` | Tu celular, para las alertas de handoff |

`DASHBOARD_URL` es opcional: si no la pones, los enlaces de las alertas usan
`VERCEL_URL`, que Vercel inyecta solo.

> **Ojo con `NEXT_PUBLIC_DISABLE_AUTH`.** En local está en `true` para entrar
> sin usuario. **No la pongas en Vercel**, o el dashboard queda abierto a
> cualquiera que dé con la URL.

---

## 4. Apuntar el webhook de Meta al dominio nuevo

Ya no hace falta ngrok: Vercel da una URL pública y estable.

En **developers.facebook.com → tu app → WhatsApp → Configuration → Webhook**:

| Campo | Valor |
|---|---|
| Callback URL | `https://TU-DOMINIO.vercel.app/api/whatsapp/webhook` |
| Verify token | El mismo de `WHATSAPP_VERIFY_TOKEN` |

Suscríbete al campo **`messages`**.

Para comprobar el webhook desplegado, desde tu máquina:

```bash
cd frontend && node scripts/probar-webhook.js https://TU-DOMINIO.vercel.app
```

Debe dar **8 pasadas, 0 fallidas**: verifica el challenge, que un POST sin
firma da 401 y que uno firmado da 200.

---

## 5. Lo que cambió al pasar a serverless

Tres cosas que funcionaban en Express y **habrían fallado en silencio** si se
copiaba el código tal cual:

**El webhook ya no responde antes de procesar.** En Express se contestaba 200
al instante y el trabajo iba en un `setImmediate`, porque el proceso sigue
vivo. En serverless la función se congela al responder y ese trabajo puede no
correr nunca: se perdería el pedido sin dejar rastro. Ahora se espera. Es
seguro porque el caso normal son milisegundos, el peor caso ronda 1.5 s, y si
Meta reintentara, el `UNIQUE` sobre `wa_message_id` hace que el reintento no
duplique nada.

**La memoria de la conversación vive en la base.** Era un `Map` en memoria.
Entre un mensaje y el siguiente, Vercel puede darte otra instancia: el
`"si porfa"` del cliente llegaría a un proceso que nunca vio la cotización, y
la huella que evita duplicar el pedido tampoco sobreviviría. Ahora se guarda en
`conversaciones_whatsapp.contexto`.

**El presupuesto de IA también.** Por lo mismo: contadores por instancia no
cuentan nada. Ahora son filas en `ia_peticiones`.

---

## 6. Lo que queda pendiente

- **Autenticación.** Las rutas de `app/api/**` no piden credenciales. El webhook
  sí está cerrado con firma HMAC, pero `/api/pedidos` y `/api/productos` están
  abiertas a quien conozca el dominio. Es lo primero que hay que cerrar.
- **Crear el usuario admin** y quitar `NEXT_PUBLIC_DISABLE_AUTH`.
- **`limpiar_ia_peticiones()`** conviene correrla de vez en cuando (o con un
  cron de Supabase) para que la tabla no crezca sin freno.
