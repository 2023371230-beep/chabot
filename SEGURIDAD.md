# Seguridad de Báscula

Qué se cerró, qué queda abierto a propósito, y qué falta.

Escrito contra el **OWASP API Security Top 10 2023**, que es el marco relevante
para esta aplicación. Las partes de la investigación que aplican a otra escala
(eBPF/XDP, HashiCorp Vault, mTLS entre microservicios, MASVS móvil) están al
final, en la sección de lo que **no** se hizo y por qué.

---

## El agujero que había

La autenticación vivía **solo en el navegador**. `ProtectedRoute` mandaba a
`/login` a quien no tuviera sesión, y eso protege las **pantallas**, no los
**datos**:

```bash
# Sin sesión, sin token, sin nada
curl https://tu-dominio.vercel.app/api/pedidos
# → la lista completa, con los teléfonos de todos los clientes
```

Y no era solo lectura:

```bash
curl -X PATCH .../api/pedidos/<id>/estado -d '{"estado":"confirmado"}'
# → confirmaba el pedido y DESCONTABA STOCK REAL
```

La guarda del frontend es comodidad de navegación. Nunca fue seguridad:
cualquiera se la salta escribiendo la URL de la API a mano.

---

## Lo que se cerró

### API2 — Autenticación rota

**17 rutas** pasan a exigir una sesión válida de Supabase. El navegador manda
el token en `Authorization: Bearer <jwt>` y el servidor lo verifica antes de
tocar la base.

**La verificación se delega en Supabase**, no se decodifica el JWT a mano. Esa
decisión elimina de raíz una familia entera de vulnerabilidades que la
investigación describe bien:

| Ataque | Por qué no aplica aquí |
|---|---|
| **Confusión de algoritmos** (RS256→HS256) | No se elige el algoritmo desde el token; no se ejecuta ningún `verify()` propio |
| **`alg: none`** | No hay analizador propio que pueda aceptarlo. **Probado: 401** |
| **Inyección por `kid`** | Nunca se lee ese parámetro |
| **JKU / X5U** | Nunca se descarga una clave desde una URL del token |

Escribir un verificador propio significa acordarse de tapar los cuatro. Delegar
en quien emitió el token significa que no existen.

El verificador usa la llave **pública**, no la `service_role`: para validar un
token basta con eso, y darle más permisos a esa función sería lo contrario del
privilegio mínimo.

Se cachea la validación **10 segundos**. Un dashboard hace varias peticiones al
pintar una pantalla y no tiene sentido revalidar el mismo token cinco veces en
el mismo segundo. La ventana es corta a propósito: una sesión revocada deja de
servir en segundos, no en minutos.

### API4 — Consumo sin restricción

| Dónde | Cuota | Por qué |
|---|---|---|
| Rutas del dashboard | 240/min **por usuario** | Se cuenta por usuario y no por IP: varias personas del mismo negocio salen por la misma IP y contarlas juntas castigaría a la segunda por el trabajo de la primera |
| Webhook de WhatsApp | 120/min por IP | Meta manda pocos por segundo; lo que corta es a quien descubre la URL y la inunda |
| `/api/health` | 60/min por IP | Está abierta y no debe servir de amplificador |
| Cuerpo del webhook | 128 KB | Se rechaza **antes** de calcular el HMAC: verificar una firma cuesta CPU |
| Peticiones a la IA | 900/día, 15/min, 20 por teléfono/hora | Ya existía; protege la cuota de Groq |

La ventana es **deslizante**, no un contador por bloque. Un contador que se
reinicia cada minuto permite el doble del límite a caballo entre dos ventanas,
que es justo el hueco que buscan los scripts.

**Limitación honesta:** el limitador vive en memoria del proceso. En Vercel
cada instancia lleva su propia cuenta, así que con varias instancias activas el
límite efectivo se multiplica. Es una mitigación parcial y conviene saberlo: la
defensa real contra un ataque volumétrico está en el borde (la protección de
Vercel, o un WAF delante), no en el código. Aun así detiene lo que de verdad le
llega a un negocio de este tamaño — un script probando contraseñas, un raspador
recorriendo la API, alguien reenviando el mismo webhook en bucle — porque eso
es tráfico de una sola fuente que cae en la misma instancia.

### API8 — Configuración insegura

Cabeceras en **toda** respuesta, puestas en `next.config.mjs` y no en un
middleware, para que las apliquen también los estáticos y las páginas de error:

| Cabecera | Qué evita |
|---|---|
| `Content-Security-Policy` | Que un script inyectado llegue a ejecutarse |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Secuestro de clics |
| `form-action 'self'` | Que un script reapunte el login a un servidor ajeno y coseche contraseñas |
| `Strict-Transport-Security` | Degradación a HTTP |
| `X-Content-Type-Options: nosniff` | Que un archivo acabe ejecutándose como script |
| `Referrer-Policy` | Filtrar rutas con ids de pedidos y clientes al salir del sitio |
| `Permissions-Policy` | Que un script pida cámara, micrófono o ubicación en nombre del sitio |
| Sin `X-Powered-By` | Anunciar la tecnología y su versión |

`'unsafe-inline'` se concede en **estilos** (Next inyecta CSS en línea para las
fuentes y el tema; quitarlo obligaría a un `nonce` por petición y rompería el
renderizado estático) pero **no en scripts**, que es donde importa.
`'unsafe-eval'` solo existe en desarrollo, porque lo necesita el refresco
rápido.

### API1 / API5 — Autorización a nivel de objeto y de función

Esta aplicación tiene **un solo inquilino y un solo rol**: no hay clientes de
clientes cuyos datos haya que aislar, ni un usuario estándar que pueda alcanzar
un endpoint de administración. Todo lo que hay detrás de la sesión es
legítimamente accesible para quien tenga sesión.

Eso lo hace correcto **hoy** y frágil **mañana**: el día que exista un segundo
usuario con menos permisos, hará falta autorización por objeto de verdad. Está
anotado en lo que falta.

### Inyección SQL

No aplica por construcción. Todo pasa por PostgREST vía `@supabase/supabase-js`
con parámetros; no hay una sola cadena de consulta concatenada. Comprobado con
`grep`: cero llamadas a `.rpc()` con SQL construido y cero interpolación en
filtros.

### Secretos

`SUPABASE_SECRET_KEY`, `GROQ_API_KEY`, `WHATSAPP_ACCESS_TOKEN` y
`WHATSAPP_APP_SECRET` viven sin el prefijo `NEXT_PUBLIC_`, así que Next no los
mete en el paquete del navegador. **Verificado, no supuesto:**

```
SUPABASE_SECRET_KEY      en .next/static: NO
GROQ_API_KEY             en .next/static: NO
WHATSAPP_ACCESS_TOKEN    en .next/static: NO
WHATSAPP_APP_SECRET      en .next/static: NO
```

### El webhook

Ya estaba cerrado antes de esta pasada: verifica la firma
`X-Hub-Signature-256` sobre los **bytes crudos** con `timingSafeEqual`. Se
mantiene abierto a sesión porque quien llama es Meta, no una persona.

---

## Cómo se comprueba

```bash
npm run probar:seguridad
```

Crea un usuario temporal, entra, golpea la API con su token, y lo borra al
terminar. **14 de 14** en la última pasada:

```
sin token           → 401  en las 6 rutas
con token válido    → 200  en las 6 rutas
firma alterada      → 401
alg:none forjado    → 401
5 cabeceras de seguridad presentes
sin X-Powered-By
```

Contra el dominio desplegado:

```bash
npm run probar:seguridad -- https://tu-dominio.vercel.app
```

---

## Lo que queda abierto a propósito

**`/api/health`** — alimenta el indicador "En línea" del navbar *antes* de que
exista sesión, y un monitor externo no puede iniciar sesión para preguntar si
el servidor vive. Lleva cuota y no expone nada sensible: hora y cuota de IA
restante, que no dice nada de clientes ni de ventas.

**`/api/whatsapp/webhook`** — se autentica con la firma HMAC de Meta.

---

## Lo que falta

### 1. La sesión vive en `localStorage`

Es el punto que la investigación señala con razón: cualquier JavaScript que se
ejecute en la página puede leerla, así que un XSS se convierte en robo de
sesión.

La mitigación actual es la CSP, que impide que ese JavaScript llegue a
ejecutarse. La solución de fondo es mover la sesión a cookies `HttpOnly` +
`Secure` + `SameSite`, lo que requiere `@supabase/ssr` y reescribir el flujo de
autenticación con un middleware de Next. **Es el siguiente trabajo de
seguridad**, no una tarea menor.

### 2. Un solo rol

Cuando exista un segundo usuario con menos permisos hará falta:
- una columna de rol y su verificación en cada ruta (API5)
- autorización por objeto donde un recurso pueda pertenecer a alguien (API1)

### 3. Rotación de credenciales

El `WHATSAPP_ACCESS_TOKEN` y las llaves de Supabase se rotan a mano. Un
orquestador de secretos con credenciales efímeras (Vault) sería lo correcto a
otra escala; para un despliegue de un solo proyecto, lo realista es
**rotarlas cuando se sospeche una fuga** y no dejarlas en ningún historial.

### 4. Registro de eventos de seguridad

Hoy los rechazos van a `console.warn`, que en Vercel queda en los registros de
la función. No hay alerta si alguien intenta mil peticiones. Un contador con
umbral que avise por el mismo canal que los handoffs sería barato y útil.

---

## Lo que NO se hizo, y por qué

La investigación es sólida pero describe una arquitectura de otra escala.
Aplicar sus capas a este proyecto sería teatro de seguridad:

| Propuesta | Por qué no aquí |
|---|---|
| **eBPF / XDP** para filtrar en el kernel | Requiere controlar el servidor. En Vercel no existe un kernel propio; el filtrado en el borde es responsabilidad de Vercel |
| **HashiCorp Vault** con credenciales efímeras | Resuelve la rotación entre muchos microservicios. Aquí hay un despliegue y un puñado de llaves; el coste operativo supera al beneficio |
| **mTLS entre servicios** | No hay servicios internos que se hablen: una sola aplicación contra Supabase por TLS |
| **Argon2id para contraseñas** | Supabase Auth hace el hash; nosotros nunca vemos ni almacenamos una contraseña. Cambiarlo no está en nuestras manos, y está bien que así sea |
| **WebAuthn / Passkeys** | Sería una mejora real, pero es un cambio de producto, no de infraestructura. Anotado como idea, no como deuda |
| **Certificate Pinning, RASP, ofuscación** (MASVS) | No hay aplicación móvil. WhatsApp es el cliente, y su seguridad la lleva Meta |
| **SSRF (API7)** | No existe ningún punto donde el usuario aporte una URL que el servidor visite |
| **Análisis de coste de consulta** (GraphQL) | La API es REST con endpoints de forma fija; no hay consultas que el cliente pueda hacer arbitrariamente caras |

Lo que sí vale la pena adoptar de la investigación, en orden: **cookies
`HttpOnly`** (punto 1 de lo que falta), y **escaneo de secretos en el
pipeline** (Gitleaks o similar) si el repositorio pasa a tener más de una
persona escribiendo.
