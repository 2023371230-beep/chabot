# Copy de interfaz — Pollito

Auditoría completa de todo el texto visible del frontend (`frontend/app`, `frontend/features`, `frontend/components`, `frontend/lib/constants.ts`), más los mensajes de error que el backend manda y que terminan mostrándose en toasts/alerts de la interfaz (marcados aparte, sección 13).

Metodología: skill `behavioral-design` (cargada — ver cierre del reporte). Cada fila aplica al menos uno de estos mecanismos: reducir carga cognitiva (menos palabras, más claras), etiqueta orientada a destino/acción (no a contenedor), prevención de error por pérdida (loss aversion) en la acción que más le puede doler al dueño — confirmar un pedido por accidente —, y cierre del ciclo de feedback (qué pasó, qué sigue).

**No se modificó ningún `.tsx`/`.ts`. Este documento es la especificación para que otro agente implemente.**

---

## 0. La regla que gobierna todo el copy del flujo de pedidos

Esto es lo que casi todo el copy de "Pedidos" tiene que dejar obvio, repetido en los momentos correctos (no solo una vez en un texto que nadie lee):

1. **Crear un pedido no toca el stock.** El pedido nace en estado "pendiente" y el inventario no se mueve.
2. **Solo "Confirmar" descuenta el stock.** Es el único botón que mueve inventario real.
3. **Cancelar un pedido ya confirmado NO regresa el stock solo** (confirmado en `pedidos.service.ts`: no hay lógica de reversión). Si se confirmó por error, hay que corregir el stock a mano desde Inventario.
4. **Mayoreo = más de 50 kg** (configurable) y **necesita días de preparación** (configurable, hoy típicamente 2). Esto se le avisa al usuario en el momento de crear el pedido, no después.

Por eso el botón de confirmar, el diálogo de confirmación (hoy no existe — ver sección 5) y los toasts posteriores son la parte de mayor impacto de todo este documento.

---

## 1. Navegación, marca y barra superior

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/lib/constants.ts:12` | `Dashboard` | `Inicio` | "Dashboard" es un préstamo técnico. "Inicio" dice qué vas a encontrar (resumen del día) sin anglicismo. |
| `frontend/lib/constants.ts:13-18` | `Pedidos`, `Productos`, `Clientes`, `Inventario`, `WhatsApp`, `Configuracion` | Sin cambio (agregar acento: `Configuración`) | Ya son etiquetas de destino claras. Solo falta el acento. |
| `frontend/app/layout.tsx:9` | `title: 'Pollito Admin'` | `title: 'Pollito'` | "Admin" es la típica cola de nombre de producto genérico ("[Marca] Admin"). El dueño es la única persona que lo usa; no hace falta aclarar que es "el admin". Ver Pending Questions — es decisión de marca, no solo copy. |
| `frontend/app/layout.tsx:10` | `description: 'Dashboard administrativo para distribuidora avicola'` | `description: 'Pedidos, inventario y clientes de la distribuidora'` | Quita "dashboard administrativo" (jerga) y dice qué hace la herramienta en términos de negocio. |
| `frontend/components/layout/top-navbar.tsx:44` | `Pollito Admin` | `Pollito` | Consistencia con el título de marca. |
| `frontend/components/layout/mobile-menu.tsx:25` | `Pollito Admin` | `Pollito` | Igual. |
| `frontend/components/layout/top-navbar.tsx:72` | `` API {backendOk ? 'online' : 'offline'} `` | `Sistema conectado` / `Sistema sin conexión` | "API online/offline" es jerga de desarrollador en inglés. El dueño necesita saber si el sistema responde, no qué es una API. |
| `frontend/components/layout/top-navbar.tsx:77` | `title="Cambiar tema"` | `title="Cambiar a modo oscuro"` / `"Cambiar a modo claro"` (dinámico según estado) | El texto actual no dice hacia dónde cambia; el tooltip debería decir el resultado, no la acción genérica. |
| `frontend/components/layout/top-navbar.tsx:84` | `{user?.email ?? 'Admin'}` | `{user?.email ?? 'Tu cuenta'}` | "Admin" como fallback es frío y técnico; como es un solo usuario, "Tu cuenta" es más directo. |
| `frontend/components/layout/top-navbar.tsx:89` | `title="Cerrar sesion"` | `title="Cerrar sesión"` (acento) | Ortografía. |
| `frontend/components/layout/top-navbar.tsx:33` | `toast.success('Sesion cerrada')` | `toast.success('Sesión cerrada')` | Ortografía; además confirma que sí cerró (feedback de wayfinding). |

---

## 2. Login

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/login/page.tsx:9` | `Distribuidora avicola` | `Distribuidora avícola` | Ortografía (falta en todo el proyecto — ver Reglas de voz). |
| `frontend/app/login/page.tsx:11` | `Pollito Admin` | `Pollito` | Consistencia de marca. |
| `frontend/features/auth/login-form.tsx:57` | `Entrar al dashboard` | `Entrar` | Con la marca ya visible arriba, repetir "al dashboard" es ruido. Un verbo basta. |
| `frontend/features/auth/login-form.tsx:59` | `Usa tu cuenta de administrador configurada en Supabase Auth.` | `Usa el correo y la contraseña que ya tienes registrados.` | "Supabase Auth" es infraestructura interna, nunca debe aparecer frente al usuario final. |
| `frontend/features/auth/login-form.tsx:65-66` | `` Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para habilitar el login. `` | `El sistema de acceso todavía no está configurado. Avísale a quien te hizo el sistema.` | Nombres de variables de entorno no deben mostrarse nunca a un usuario real, ni siquiera en un estado de error. Si esto solo debería verse en desarrollo, es un tema aparte para Vigil/Rune — pero si llega a producción, este es el texto. |
| `frontend/features/auth/login-form.tsx:71` (label) | `Email` | `Correo` | Español consistente; "correo" es la palabra que usa cualquier persona en México, no "email". |
| `frontend/features/auth/login-form.tsx:72` | `placeholder="admin@empresa.com"` | `placeholder="tucorreo@ejemplo.com"` | El placeholder actual sugiere que el sistema es "de administradores"; es simplemente su correo. |
| `frontend/features/auth/login-form.tsx:76` (label) | `Password` | `Contraseña` | Mismo criterio: nada de inglés cuando hay palabra común en español. |
| `frontend/features/auth/login-form.tsx:82-85` | `Iniciar sesion` | `Entrar` | Verbo corto, consistente con el título de la tarjeta. |
| `frontend/features/auth/login-form.tsx:37` | `toast.success('Sesion iniciada')` | (quitar el toast) | Al iniciar sesión, la pantalla cambia de inmediato a Inicio — un toast que desaparece antes de terminar la redirección es ruido. Si se conserva, corregir ortografía a "Sesión iniciada". |
| `frontend/features/auth/login-form.tsx:40` | `'No se pudo iniciar sesion'` | `'No pudimos iniciar tu sesión. Intenta otra vez.'` | Da un siguiente paso, no solo constata el fallo. |
| `frontend/features/auth/login-form.tsx:43-44` | `'Credenciales incorrectas. Revisa email y password.'` | `'Correo o contraseña incorrectos. Revísalos e intenta de nuevo.'` | Español consistente ("email"/"password" en inglés) + reformulado como instrucción, no regaño. |

---

## 3. Inicio (Dashboard)

Las 6 métricas son el primer vistazo del día — tienen que responder "¿qué necesito hacer hoy?", no solo listar números.

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/dashboard/page.tsx:40` | `Dashboard` | `Inicio` | Ver sección 1. |
| `frontend/app/dashboard/page.tsx:41` | `Operacion diaria de pedidos, kilogramos, stock y preparacion de mayoreo.` | `Lo que pasa hoy: pedidos, kilos vendidos, stock y qué necesita prepararse con tiempo.` | Menos abstracto ("operación diaria" no dice nada), mismo contenido en lenguaje hablado. |
| `frontend/features/dashboard/dashboard-kpis.tsx:31` | `Pedidos totales` | `Total de pedidos` | Orden natural en español ("total de X" en vez de "X totales"). |
| `frontend/features/dashboard/dashboard-kpis.tsx:33` | `Pendientes` | `Por confirmar` | Adjetivo estático → etiqueta orientada a acción. "Pendientes" no dice qué hacer; "Por confirmar" dice exactamente la acción que falta y conecta directo con la regla del stock. |
| `frontend/features/dashboard/dashboard-kpis.tsx:39` | `Kg pedidos` | `Kilos en pedidos` | La actual es agramatical (sustantivo+sustantivo pegado). |
| `frontend/features/dashboard/dashboard-kpis.tsx:45` | `Productos activos` | Sin cambio | Ya es clara. |
| `frontend/features/dashboard/dashboard-kpis.tsx:51` | `Stock bajo` | Sin cambio (agregar tooltip/description futura: "productos por debajo de su mínimo") | Clara tal cual; si se agrega `description` al MetricCard, usar esa frase. |
| `frontend/features/dashboard/dashboard-kpis.tsx:57-60` | `WhatsApp` / valor `Preparado` / descripción `Webhook manual listo` | `WhatsApp` / valor `Manual` / descripción `Los pedidos por WhatsApp se capturan a mano por ahora` | "Webhook manual listo" es jerga de desarrollo que no significa nada para el dueño. Esta tarjeta no mide nada real todavía (es un estado fijo); el texto nuevo es honesto sobre el estado actual sin usar la palabra "webhook". Ver Pending Questions: considerar quitar esta tarjeta hasta que mida algo real. |
| `frontend/app/dashboard/page.tsx:28` | `No se pudo cargar el dashboard` | `No se pudo cargar el inicio` | Consistencia con el rename de la sección. |
| `frontend/app/dashboard/page.tsx:55` | `Accesos rapidos` | `Accesos rápidos` | Ortografía. |
| `frontend/app/dashboard/page.tsx:61` | `Nuevo pedido` | Sin cambio | Ya es específico. |
| `frontend/app/dashboard/page.tsx:67` | `Registrar movimiento` | Sin cambio | Ya es específico. |
| `frontend/app/dashboard/page.tsx:73` | `Editar configuracion` | `Ver reglas del negocio` | Ver sección 10 — "configuración" se renombra a "reglas del negocio" en toda la app. |
| `frontend/features/dashboard/inventory-alerts.tsx:19` | `Alertas de inventario` | Sin cambio | Clara. |
| `frontend/features/dashboard/inventory-alerts.tsx:33-35` | `Actual {x} · minimo {y}` | `Tienes {x} · mínimo {y}` | "Actual" es una etiqueta de sistema; "Tienes" habla directo al dueño. |
| `frontend/features/dashboard/inventory-alerts.tsx:43-44` | `Todo el inventario esta sobre minimo.` | `Todo tu stock está por arriba del mínimo.` | Más directo, corrige ortografía, "tu" personaliza. |
| `frontend/features/dashboard/inventory-alerts.tsx:47` | `Ver inventario` | Sin cambio | Clara. |
| `frontend/features/dashboard/recent-orders.tsx:15` | `Pedidos recientes` | Sin cambio | Clara. |

---

## 4. Pedidos — lista y creación

Este es el segundo punto de mayor impacto: es donde se debe sembrar por primera vez la idea de "esto no toca tu stock todavía".

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/pedidos/page.tsx:80` | `Pedidos` | Sin cambio | Clara. |
| `frontend/app/pedidos/page.tsx:81` | `Control de pedidos por kilogramo con estados e impacto de inventario al confirmar.` | `Aquí creas y das seguimiento a tus pedidos. Crear un pedido no quita nada del stock — el stock se descuenta hasta que lo confirmas.` | Este es el lugar #1 para instalar la regla. Frase densa original reemplazada por dos oraciones cortas y la regla explícita en la segunda mitad. |
| `frontend/app/pedidos/page.tsx:92` | `Nuevo pedido` (DialogTitle) | Sin cambio | Clara. |
| `frontend/app/pedidos/page.tsx:94` | `El backend calcula precios, totales y advertencias de mayoreo.` | `El total se calcula solo. Si el pedido pasa de 50 kg te vamos a avisar que es mayoreo y necesita más días.` | Quita "backend" (jerga) y "advertencias de mayoreo" (abstracto) por la regla concreta con el número real. Si el límite es configurable, usar el valor de configuración en vez de "50" fijo — ver nota de implementación. |
| `frontend/app/pedidos/page.tsx:133` | `placeholder="Buscar cliente o telefono"` | `placeholder="Buscar por cliente o teléfono"` | Preposición + acento. |
| `frontend/app/pedidos/page.tsx:146` | `Todos` (filtro de estado) | Sin cambio | Clara. |
| `frontend/app/pedidos/page.tsx:66` | `toast.success(result.warnings?.length ? 'Pedido creado con advertencia' : 'Pedido creado')` | `'Pedido creado. Revisa las advertencias antes de confirmarlo.'` (con warnings) / `'Pedido creado. Todavía no se descuenta del stock.'` (sin warnings) | El momento justo después de crear es donde más se necesita la reafirmación de la regla — es cuando el dueño podría asumir erróneamente que ya se descontó. |
| `frontend/app/pedidos/page.tsx:70` | `'No se pudo crear pedido'` | `'No se pudo crear el pedido. Intenta de nuevo.'` | Agrega artículo y siguiente paso. |
| `frontend/app/pedidos/page.tsx:111` | `No se pudieron cargar los pedidos` | Sin cambio | Clara. |
| `frontend/features/pedidos/orders-table.tsx:61` | `Crea el primer pedido desde el dashboard o desde WhatsApp.` | `Los pedidos que captures aquí o que lleguen por WhatsApp van a aparecer en esta lista.` | Empty state de primer uso: debe explicar qué va a pasar, no solo invitar a crear. También corrige "dashboard" → "aquí". |
| `frontend/features/pedidos/orders-table.tsx:60` | `Sin pedidos` | `Todavía no tienes pedidos` | Más cálido, menos "mensaje de sistema". |
| `frontend/features/pedidos/order-form.tsx:149` | `Seleccionar cliente o capturar nuevo` | `Buscar cliente o dejarlo vacío para uno nuevo` | Más claro sobre qué hacer si el cliente no existe. |
| `frontend/features/pedidos/order-form.tsx:166` (label) | `Direccion` | `Dirección` | Acento (falta en todo el proyecto). |
| `frontend/features/pedidos/order-form.tsx:169` (label) | `Fecha entrega` | `Fecha de entrega` | Falta la preposición — sin ella suena a etiqueta de base de datos. |
| `frontend/features/pedidos/order-form.tsx:173-186` (label + opciones) | `Origen` con opciones `dashboard`, `manual`, `whatsapp` (valores crudos) | Label: `¿Cómo llegó el pedido?` — opciones mostradas como: `dashboard` → `Capturado aquí`, `manual` → `Por teléfono o en persona`, `whatsapp` → `Por WhatsApp` | El select hoy muestra el valor interno tal cual ("dashboard" como opción dentro del propio dashboard es confuso — suena circular). Necesita un mapa de texto visible ≠ valor guardado (cambio de código menor, no solo texto: agregar objeto de labels en el componente). |
| `frontend/features/pedidos/order-form.tsx:192` | `Productos` (h3) | Sin cambio | Clara. |
| `frontend/features/pedidos/order-form.tsx:193` | `Selecciona producto y kilogramos.` | `Elige el producto y cuántos kilos.` | Más hablado, menos instrucción de manual. |
| `frontend/features/pedidos/order-form.tsx:202-204` | `Agregar` (botón) | `Agregar producto` | Específico: qué se agrega. |
| `frontend/features/pedidos/order-form.tsx:239` (botón sin texto, solo ícono de basura) | *(sin texto — falta `title`)* | Agregar `title="Quitar producto"` | Botón de solo ícono sin accesible name; sin esto, no queda claro qué hace el ícono ni para lectores de pantalla. |
| `frontend/features/pedidos/order-form.tsx:246` | `Total estimado` | Sin cambio | Correcto tal cual: el peso real puede variar un poco al empacar, así que "estimado" es honesto, no vago. |
| `frontend/features/pedidos/order-form.tsx:254` | `placeholder="Separar en bolsas, entregar por la manana..."` | `placeholder="Separar en bolsas, entregar por la mañana..."` | Ortografía (falta ñ). |
| `frontend/features/pedidos/order-form.tsx:259` | `Crear pedido` | Sin cambio en el botón; **agregar debajo** una línea nueva: `Se guarda como pendiente. El stock se descuenta cuando lo confirmes.` | Refuerza la regla justo antes de la acción — el usuario puede haber hecho scroll y ya no ver la descripción del diálogo de arriba. Es el punto de decisión, el lugar de más impacto para prevenir el error. |
| `frontend/features/pedidos/order-form.tsx:22` (schema) | `Telefono requerido` | `Falta el teléfono` | Los mensajes de validación deben sonar a instrucción, no a campo de formulario burocrático. |
| `frontend/features/pedidos/order-form.tsx:27` | `Fecha invalida` | `Esa fecha no es válida` | Igual. |
| `frontend/features/pedidos/order-form.tsx:33` | `Producto requerido` | `Elige un producto` | Igual. |
| `frontend/features/pedidos/order-form.tsx:36` | `Kg debe ser mayor a 0` | `Pon cuántos kilos (más de 0)` | Igual. |
| `frontend/features/pedidos/order-form.tsx:46` | `Nombre requerido para pedidos del dashboard` | `Falta el nombre del cliente` | Quita "pedidos del dashboard" (irrelevante para el usuario, es lógica interna). |

**Nota de implementación:** el límite de 50 kg y los días de preparación vienen de Configuración (`kg_limite_rapido`, `dias_preparacion_mayoreo`). Donde el copy dice "50 kg" o "más días", debe interpolarse el valor real de configuración, no quedar fijo en el texto.

---

## 5. Confirmar / Cancelar / Completar un pedido — CRÍTICO

Hoy `order-status-actions.tsx` ejecuta el cambio de estado **al primer clic, sin diálogo de confirmación**. Confirmar es la única acción que mueve inventario real y no tiene ningún paso intermedio que lo frene. Esto es lo más importante de todo el documento.

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/features/pedidos/order-status-actions.tsx:30-33` | Botón `Confirmar` | Botón `Confirmar y descontar stock` | El botón que dispara la acción irreversible-en-la-práctica debe nombrar la consecuencia en el propio botón, no solo en un texto de apoyo que se puede ignorar (loss aversion + consecuencia explícita). |
| `frontend/features/pedidos/order-status-actions.tsx:30-33` | *(sin diálogo previo)* | **Agregar `ConfirmDialog`** con: título `¿Confirmar este pedido?`, descripción `Se van a descontar del stock los kilos de este pedido. Si te equivocas, cancelar el pedido no regresa el stock solo — tendrías que hacer un ajuste manual en Inventario.`, botón de acción `Sí, confirmar y descontar stock`, botón de cancelar `No, todavía no` | Esta es la recomendación de mayor impacto de todo el documento. Hoy no existe ningún freno entre el clic y el descuento de stock real. Un diálogo con la consecuencia explícita (incluyendo que cancelar después NO revierte el stock, confirmado en `pedidos.service.ts`) es la única defensa real contra el error que el usuario más teme. Requiere que `ConfirmDialog` tenga botón de cancelar explícito — hoy no lo tiene (ver sección 12). |
| `frontend/features/pedidos/order-status-actions.tsx:36-39` | Botón `Completar` | Botón `Marcar como entregado` | "Completar" es ambiguo (¿completar qué?). "Marcar como entregado" describe la consecuencia real: el pedido ya se entregó/cobró. No mueve stock (ya se movió al confirmar), así que no necesita diálogo de advertencia, pero sí un texto que no sugiera otra acción sobre inventario. |
| `frontend/features/pedidos/order-status-actions.tsx:42-45` | Botón `Cancelar` | Botón `Cancelar pedido` | Especificidad: qué se cancela. |
| `frontend/features/pedidos/order-status-actions.tsx:42-45` (cuando `order.estado === 'confirmado'`) | *(sin distinción — mismo botón "Cancelar" que para pendientes)* | Si el pedido ya está `confirmado`, el diálogo de cancelar debe decir: `Este pedido ya estaba confirmado y su stock ya se descontó. Cancelarlo no lo regresa automáticamente — hazlo con un movimiento de ajuste en Inventario si hace falta.` Si está `pendiente`, el diálogo puede ser más simple: `¿Cancelar este pedido? Como no está confirmado, no afecta tu stock.` | Cancelar un pedido pendiente y cancelar uno confirmado tienen consecuencias completamente distintas en inventario real, y hoy el botón no distingue entre los dos casos. Confirmado con la lógica de `updateOrderStatus` en el backend: no hay reversión de stock al cancelar. |
| `frontend/features/pedidos/order-status-actions.tsx:19` | `toast.success('Estado actualizado')` | Según la acción: `'Pedido confirmado. Se descontaron {kg} kg del stock.'` / `'Pedido marcado como entregado.'` / `'Pedido cancelado.'` | "Estado actualizado" no dice a qué estado ni qué pasó con el inventario. El toast es la última oportunidad de cerrar el ciclo (¿lo hice bien? ¿qué pasó de verdad?) — debe confirmar la consecuencia real, no solo que "algo" cambió. |
| `frontend/features/pedidos/order-status-actions.tsx:23` | `'No se pudo cambiar estado'` | `'No se pudo cambiar el estado del pedido. Intenta de nuevo.'` | Agrega artículo + siguiente paso. Si el error es por stock insuficiente al confirmar, ver sección 13 — ese mensaje necesita su propio rediseño porque hoy es aún más confuso. |

---

## 6. Detalle de pedido

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/pedidos/[id]/page.tsx:29` | `Detalle de pedido` | Sin cambio | Clara. |
| `frontend/app/pedidos/[id]/page.tsx:30` | `` `Pedido ${order.data.id}` `` (muestra el UUID completo) | `` `Pedido de ${cliente?.nombre ?? 'cliente sin nombre'} — ${formatDate(order.data.fecha_entrega)}` `` | Un UUID no significa nada para el dueño y no ayuda a reconocer el pedido de un vistazo. Nombre del cliente + fecha de entrega sí. |
| `frontend/app/pedidos/[id]/page.tsx:21` | `No se pudo cargar el pedido` / fallback `Pedido no encontrado` | Sin cambio | Clara. |
| `frontend/features/pedidos/order-detail.tsx:24` | `Total kg` | `Total de kilos` | Consistencia con el resto ("Kilos en pedidos" en Inicio). |
| `frontend/features/pedidos/order-detail.tsx:25` | `Total` | Sin cambio | Clara junto al ícono de dinero. |
| `frontend/features/pedidos/order-detail.tsx:26` | `Entrega` | `Fecha de entrega` | Igual criterio que en el formulario. |
| `frontend/features/pedidos/order-detail.tsx:31` | `Productos del pedido` | Sin cambio | Clara. |
| `frontend/features/pedidos/order-detail.tsx:16-18` (headers) | `Kg`, `Precio kg`, `Subtotal` | `Kilos`, `Precio por kg`, `Subtotal` | "Precio kg" es agramatical; "Precio por kg" es como cualquier persona lo diría. |
| `frontend/features/pedidos/order-detail.tsx:39` | `Cliente y estado` | Sin cambio | Clara. |
| `frontend/features/pedidos/order-detail.tsx:44` | fallback `Sin nombre` | `Cliente sin nombre registrado` | Un poco más específico sobre por qué falta. |
| `frontend/features/pedidos/order-detail.tsx:48` | fallback `Sin telefono` | `Sin teléfono registrado` | Ortografía + especificidad. |
| `frontend/features/pedidos/order-detail.tsx:57-58` | `Origen` + valor crudo (`dashboard`/`manual`/`whatsapp`) | `Cómo llegó` + valores mapeados: `Capturado aquí` / `Por teléfono o en persona` / `Por WhatsApp` | Mismo problema del select del formulario (sección 4): el valor interno no debe imprimirse tal cual en pantalla. |
| `frontend/features/pedidos/order-detail.tsx:61` | fallback `Sin notas` | Sin cambio | Clara. |
| `frontend/features/pedidos/order-detail.tsx:65` | `Timeline` | `Historial` | "Timeline" es anglicismo innecesario cuando "Historial" dice lo mismo y es la palabra que cualquier mexicano usaría. |
| `frontend/features/pedidos/order-detail.tsx:67-68` | `Creado: {fecha}` / `Actualizado: {fecha}` | `Se creó: {fecha}` / `Último cambio: {fecha}` | Frases completas en vez de etiquetas de log. |
| `frontend/features/pedidos/order-detail.tsx:34` | *(DataTable sin `emptyTitle`/`emptyDescription` — cae al default `Sin datos`)* | `emptyTitle="Sin productos"` `emptyDescription="Este pedido no tiene productos cargados."` | Caso límite (no debería pasar) pero si pasa, el default genérico "Sin datos" no ayuda a diagnosticar. |

---

## 7. Productos

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/productos/page.tsx:60` | `Productos` | Sin cambio | Clara. |
| `frontend/app/productos/page.tsx:61` | `Catalogo operativo con precio por kilogramo, stock actual y minimo.` | `Aquí manejas tus cortes: precio por kilo, cuánto tienes y desde cuándo avisar que se está acabando.` | "Catálogo operativo" es jerga corporativa; "cortes" es la palabra real del giro (pollo por partes). |
| `frontend/app/productos/page.tsx:72` | `Nuevo producto` | `Nuevo corte` | Ver Pending Questions: confirmar si "producto" o "corte" es la palabra que usa el dueño en su día a día — probablemente "corte" (pechuga, pierna, etc. son cortes de pollo). Si se confirma, cambiar en todas las pantallas de Productos. |
| `frontend/app/productos/page.tsx:79` | `El precio y stock se guardan en el backend y se usan para pedidos.` | `El precio y el stock que pongas aquí son los que se usan al armar un pedido.` | Quita "backend"; conecta directo con el efecto (lo que se usa en Pedidos). |
| `frontend/app/productos/page.tsx:89` | `No se pudieron cargar los productos` | Sin cambio | Clara. |
| `frontend/app/productos/page.tsx:35` | `toast.success(editing ? 'Producto actualizado' : 'Producto creado')` | Sin cambio (o `'Corte actualizado'`/`'Corte creado'` si se adopta el rename) | Ya es clara. |
| `frontend/app/productos/page.tsx:40` | `'No se pudo guardar'` | `'No se pudo guardar. Revisa los datos e intenta de nuevo.'` | Da siguiente paso. |
| `frontend/app/productos/page.tsx:50` | `toast.success(product.activo ? 'Producto desactivado' : 'Producto activado')` | Sin cambio | Clara. |
| `frontend/app/productos/page.tsx:53` | `'No se pudo actualizar'` | `'No se pudo actualizar. Intenta de nuevo.'` | Siguiente paso. |
| `frontend/features/productos/product-form.tsx:71` | Field `Nombre`, placeholder `Pechuga` | Sin cambio | Ejemplo real, correcto. |
| `frontend/features/productos/product-form.tsx:74` | Field `Categoria`, placeholder `pollo` | Sin cambio | Clara. |
| `frontend/features/productos/product-form.tsx:77` | `Precio por kg` | Sin cambio | Clara. |
| `frontend/features/productos/product-form.tsx:80` | `Stock actual` | Sin cambio | Clara. |
| `frontend/features/productos/product-form.tsx:83` | `Stock minimo` | `Stock mínimo` | Acento. |
| `frontend/features/productos/product-form.tsx:89` | `Guardar producto` | Sin cambio (o `Guardar corte`) | Consistente con el rename opcional. |
| `frontend/features/productos/product-form.tsx:14,16-18` (schema) | `Nombre requerido`, `Debe ser mayor o igual a 0` ×3 | `Falta el nombre`, `No puede ser negativo` | Instrucción en vez de constatación de regla de validación. |
| `frontend/features/productos/product-actions.tsx:21-24` | `Desactivar` / `Activar` (sin confirmación) | Mantener el texto del botón, pero **agregar diálogo de confirmación** solo para "Desactivar": título `¿Desactivar {nombre}?`, descripción `Ya no va a aparecer para armar pedidos nuevos. El stock no se pierde y lo puedes reactivar cuando quieras.` | Desactivar un producto sin avisar puede sacarlo de circulación sin que el dueño se dé cuenta hasta que un pedido falle. El texto resuelve la ansiedad real (SUE: "¿voy a perder el stock?") antes de que exista. |
| `frontend/features/productos/product-actions.tsx:18` | `title="Editar"` | Sin cambio | Clara. |
| `frontend/features/productos/products-table.tsx:36-40` | Badge `bajo` / `ok` | `bajo` / `bien` | "Ok" es anglicismo; "bien" es la palabra en español y sigue siendo corta para un badge. |
| `frontend/features/productos/products-table.tsx:44` | `Minimo` | `Mínimo` | Acento. |
| `frontend/features/productos/products-table.tsx:67-68` | `Sin productos` / `Crea el primer producto para comenzar a registrar pedidos.` | `Todavía no tienes productos` / `Agrega tus cortes (pechuga, pierna, muslo...) para poder armar pedidos.` | Empty state de primer uso con ejemplo concreto del propio giro, no genérico. |

---

## 8. Clientes

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/clientes/page.tsx:48` | `Clientes` | Sin cambio | Clara. |
| `frontend/app/clientes/page.tsx:49` | `Base de clientes para pedidos manuales, dashboard y futuros mensajes de WhatsApp.` | `Guarda aquí tus clientes para no volver a capturar sus datos en cada pedido.` | La versión actual expone roadmap interno ("futuros mensajes de WhatsApp") que no le sirve al usuario hoy; el beneficio real es no repetir captura. |
| `frontend/app/clientes/page.tsx:60` | `Nuevo cliente` | Sin cambio | Clara. |
| `frontend/app/clientes/page.tsx:67` | `El telefono es unico y permite reconocer clientes desde WhatsApp.` | `El teléfono no se puede repetir — así el sistema reconoce quién escribe por WhatsApp.` | Ortografía + reformulado como explicación de causa-efecto en vez de descripción técnica de una restricción de base de datos. |
| `frontend/app/clientes/page.tsx:77` | `No se pudieron cargar los clientes` | Sin cambio | Clara. |
| `frontend/app/clientes/page.tsx:34` | `toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')` | Sin cambio | Clara. |
| `frontend/app/clientes/page.tsx:39` | `'No se pudo guardar'` | `'No se pudo guardar. Revisa los datos e intenta de nuevo.'` | Siguiente paso. |
| `frontend/features/clientes/client-form.tsx:54,57,61,64` | `Nombre`, `Telefono`, `Direccion`, `Notas` | `Nombre`, `Teléfono`, `Dirección`, `Notas` | Acentos. |
| `frontend/features/clientes/client-form.tsx:69` | `Guardar cliente` | Sin cambio | Clara. |
| `frontend/features/clientes/client-form.tsx:15-16` (schema) | `Nombre requerido`, `Maximo 120 caracteres`, `Telefono requerido`, `Maximo 30 caracteres` | `Falta el nombre`, `Máximo 120 caracteres`, `Falta el teléfono`, `Máximo 30 caracteres` | Instrucción + acentos. |
| `frontend/features/clientes/clients-table.tsx:28-29` | fallback `Sin direccion` / `Sin notas` | `Sin dirección` / `Sin notas` | Acento. |
| `frontend/features/clientes/clients-table.tsx:54-55` | `Sin clientes` / `Crea clientes para acelerar los pedidos recurrentes.` | `Todavía no tienes clientes` / `Guarda a tus clientes frecuentes para armar sus pedidos más rápido.` | Empty state de primer uso más cálido y concreto. |

---

## 9. Inventario

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/inventario/page.tsx:42` | `Inventario` | Sin cambio | Clara. |
| `frontend/app/inventario/page.tsx:43` | `Lectura rapida de stock y movimientos que impactan productos.` | `Aquí ves cuánto stock tienes y registras entradas, mermas o ajustes.` | "Movimientos que impactan productos" es fraseo de sistema; la versión nueva dice qué se hace aquí en verbos concretos. |
| `frontend/app/inventario/page.tsx:59` | `Registrar movimiento` | Sin cambio | Clara. |
| `frontend/app/inventario/page.tsx:47` | `No se pudo cargar inventario` | `No se pudo cargar el inventario` | Falta artículo. |
| `frontend/app/inventario/page.tsx:29` | `toast.success('Movimiento registrado')` | Sin cambio | Clara. |
| `frontend/app/inventario/page.tsx:32` | `'No se pudo registrar'` | `'No se pudo registrar. Intenta de nuevo.'` | Siguiente paso. |
| `frontend/features/inventario/inventory-movement-form.tsx:66` | `Selecciona producto` | `Selecciona el corte` (si se adopta rename de sección 7) o sin cambio | Consistencia opcional. |
| `frontend/features/inventario/inventory-movement-form.tsx:81-99` (Label `Tipo` + opciones `entrada`/`venta`/`ajuste`/`merma`) | Sin texto de ayuda | Agregar debajo del Select: `Si la venta ya pasó por un pedido, no la registres aquí — el stock ya se descontó al confirmarlo. Usa "venta" solo para ventas que no pasaron por el sistema.` | Riesgo real de doble descuento: el mismo kilo se puede restar dos veces si el dueño registra "venta" aquí para algo que ya se descontó al confirmar un pedido. Esto es tan importante como la advertencia de confirmar pedido — mismo mecanismo de prevención de error, otro punto de entrada al mismo error. |
| `frontend/features/inventario/inventory-movement-form.tsx:101` | `Cantidad kg` | `Cantidad (kg)` | Formato de unidad entre paréntesis en vez de pegada al nombre del campo. |
| `frontend/features/inventario/inventory-movement-form.tsx:22,24` (schema) | `Selecciona un producto`, `Debe ser mayor a 0`, `Maximo 10000 kg` | `Elige un producto`, `Tiene que ser más de 0`, `Máximo 10,000 kg` | Instrucción + acento + separador de miles para legibilidad. |
| `frontend/features/inventario/inventory-summary.tsx:27-33` | Badge `bajo` / `ok` | `bajo` / `bien` | Mismo criterio que en Productos. |
| `frontend/features/inventario/inventory-summary.tsx:43` | `Sin inventario` (sin descripción) | `emptyTitle="Sin movimientos todavía"` `emptyDescription="Registra tu primera entrada de stock para ver el resumen aquí."` | Empty state sin descripción no orienta qué hacer. |
| `frontend/features/inventario/inventory-movements-table.tsx:35` | fallback `Sin motivo` | Sin cambio | Clara. |
| `frontend/features/inventario/inventory-movements-table.tsx:43` | `Sin movimientos` (sin descripción) | `emptyDescription="Los movimientos que registres van a aparecer aquí."` | Igual que arriba. |

---

## 10. Configuración → renombrar a "Reglas del negocio"

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/lib/constants.ts:18` | `Configuracion` (nav) | `Configuración` (o `Reglas` si se adopta el rename completo — ver abajo) | Ver Pending Questions: decidir si el nombre en el menú cambia también, o solo el contenido de la página. Recomendación: dejar el nav como `Configuración` (ya es un término que la gente reconoce como "ajustes") y renombrar solo el título/tarjeta interna a lenguaje de negocio. |
| `frontend/app/configuracion/page.tsx:46` | `Configuracion` (H1) | `Configuración` | Acento. |
| `frontend/app/configuracion/page.tsx:47` | `Reglas operativas que el backend usa para advertencias de mayoreo y fuera de horario.` | `Aquí defines desde cuántos kilos un pedido es mayoreo, cuántos días de preparación necesita, y tu horario de atención.` | Quita "backend" y "reglas operativas" (jerga); dice exactamente qué se configura, en el mismo orden que los campos del formulario. |
| `frontend/app/configuracion/page.tsx:51` | `Reglas de negocio` (CardTitle) | `Mayoreo y horario` | "Reglas de negocio" es traducción literal de "business rules"; el título nuevo describe el contenido real de la tarjeta (test de la etiqueta: predecir contenido). |
| `frontend/app/configuracion/page.tsx:21` | `No se pudo cargar la configuracion` | `No se pudo cargar la configuración` | Acento. |
| `frontend/app/configuracion/page.tsx:34` | `toast.success('Configuracion actualizada')` | `'Cambios guardados'` | Más corto, más humano, y no repite la palabra "configuración" que ya se está retirando del vocabulario de cara al usuario. |
| `frontend/app/configuracion/page.tsx:37` | `'No se pudo actualizar'` | `'No se pudieron guardar los cambios. Intenta de nuevo.'` | Siguiente paso. |
| `frontend/features/configuracion/configuration-form.tsx:66` | `Kg limite rapido` | `Kilos máximos para pedido normal` | El nombre actual no dice qué controla. El nuevo conecta directo con la consecuencia (arriba de esto, es mayoreo). |
| `frontend/features/configuracion/configuration-form.tsx:71-73` | `Los pedidos mayores a este limite requieren preparacion especial.` | `Los pedidos con más kilos que esto se marcan como mayoreo y piden más días de preparación.` | Usa la palabra "mayoreo" explícitamente (es el término que el dueño ya usa) en vez de "preparación especial", que es vago. |
| `frontend/features/configuracion/configuration-form.tsx:76` | `Dias preparacion mayoreo` | `Días de preparación para mayoreo` | Preposiciones completas — la actual suena a nombre de columna de base de datos. |
| `frontend/features/configuracion/configuration-form.tsx:83-85` | `Dias minimos de preparacion para pedidos mayores al limite.` | `Cuántos días necesitas para tener listo un pedido de mayoreo.` | Redacción hablada, conecta con el campo de arriba usando "mayoreo" en vez de "el límite". |
| `frontend/features/configuracion/configuration-form.tsx:88` | `Horario apertura` | `Hora de apertura` | Preposición. |
| `frontend/features/configuracion/configuration-form.tsx:95` | `Horario cierre` | `Hora de cierre` | Preposición. |
| `frontend/features/configuracion/configuration-form.tsx:103` | `Mensaje fuera de horario` | Sin cambio | Clara. |
| `frontend/features/configuracion/configuration-form.tsx:105-107` | `Horario usado para respuestas automaticas fuera de horario.` | `Este mensaje se envía solo por WhatsApp, cuando alguien escribe fuera de tu horario de atención.` | El texto actual repite "horario" dos veces y no explica qué es el campo (un mensaje automático), solo cuándo se "usa el horario" — no calza con la etiqueta de arriba. |
| `frontend/features/configuracion/configuration-form.tsx:111` | `Guardar configuracion` | `Guardar cambios` | Consistente con el toast y con el rename de la sección. |
| `frontend/features/configuracion/configuration-form.tsx:15,18-29` (schema) | `Debe ser mayor a 0`, `Debe ser entero`, `Debe ser mayor o igual a 0`, `Maximo 30 dias`, `Hora invalida` ×2, `Apertura y cierre no pueden ser iguales`, `El cierre debe ser despues de la apertura` | `Tiene que ser más de 0`, `Tiene que ser un número entero`, `No puede ser negativo`, `Máximo 30 días`, `Esa hora no es válida` ×2, `La apertura y el cierre no pueden ser iguales`, `El cierre tiene que ser después de la apertura` | Instrucción hablada en vez de constatación de regla; acentos. |

---

## 11. WhatsApp

Esta pantalla hoy es, en el fondo, una lista de pendientes de desarrollo disfrazada de funcionalidad. Es el peor caso de jerga técnica expuesta directamente al dueño.

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/whatsapp/page.tsx:13` | `WhatsApp` | Sin cambio | Clara. |
| `frontend/app/whatsapp/page.tsx:14` | `Modulo preparado para webhook manual, futura conexion real e IA de extraccion.` | `Por ahora puedes probar cómo el sistema entiende un mensaje de pedido. La conexión automática con WhatsApp todavía no está activa.` | "Módulo", "webhook manual", "IA de extracción" son términos de desarrollador puro. La versión nueva explica, en honesto y llano, qué puede hacer hoy y qué no. |
| `frontend/app/whatsapp/page.tsx:21` | `Probar webhook manual` | `Probar un mensaje de pedido` | Quita "webhook"; describe la acción real: escribes un mensaje como si fuera de un cliente y ves qué entiende el sistema. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:53` | `Telefono` | `Teléfono` | Acento. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:58` | `Mensaje` | Sin cambio | Clara. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:64` | `Enviar prueba` | `Probar mensaje` | Consistente con el nuevo título de la tarjeta. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:42` | `toast.success('Webhook probado')` | `'Listo, así es como el sistema lo entendió'` | Quita "webhook"; describe el resultado (mira el JSON de abajo) en vez de nombrar la pieza técnica que se acaba de ejecutar. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:44` | `'No se pudo probar'` | `'No se pudo probar el mensaje. Intenta de nuevo.'` | Siguiente paso. |
| `frontend/features/whatsapp/whatsapp-test-form.tsx:16-17` (schema) | `Telefono requerido`, `Mensaje requerido` | `Falta el teléfono`, `Falta el mensaje` | Instrucción. |
| `frontend/features/whatsapp/whatsapp-messages-placeholder.tsx:7` | `Mensajes recientes` / `Preparado para listar conversaciones cuando el backend exponga GET.` | Recomendación: **quitar esta tarjeta** (y las otras dos) hasta que midan algo real — ver Pending Questions. Si debe quedarse visible, texto honesto: `Conversaciones` / `Todavía no puedes ver aquí los mensajes de tus clientes.` | "Cuando el backend exponga GET" es una nota interna de desarrollo, no contenido de producto. Ninguna de las tres tarjetas de esta pantalla mide algo real hoy — son honestamente un recordatorio para el equipo de desarrollo, no una funcionalidad. |
| `frontend/features/whatsapp/whatsapp-messages-placeholder.tsx:8` | `Estado bot` / `Aqui vivira el estado de Baileys o Meta WhatsApp Cloud API.` | Igual que arriba — quitar, o `Conexión automática` / `Todavía no está conectado el WhatsApp automático.` | "Baileys", "Meta WhatsApp Cloud API" son nombres de librerías/servicios, cero significado para el dueño. |
| `frontend/features/whatsapp/whatsapp-messages-placeholder.tsx:9` | `IA Groq` / `El extractor ya esta preparado; falta configurar GROQ_API_KEY.` | Igual que arriba — quitar, o `Lectura automática de pedidos` / `Todavía no está activada.` | "GROQ_API_KEY" es una variable de entorno; nunca debe imprimirse en una pantalla de producto. |

---

## 12. Estados compartidos (vacíos, error, carga, confirmación)

| Archivo:línea | Texto actual | Texto nuevo | Por qué |
|---|---|---|---|
| `frontend/app/error.tsx:12` | `Algo salio mal` | `Algo salió mal` | Acento; además es la pantalla de crisis genérica, no cambia el mensaje pero sí la ortografía. |
| `frontend/app/error.tsx:13` | `La vista no pudo cargarse. Reintenta o revisa la conexion con el backend.` | `No pudimos cargar esta pantalla. Revisa tu conexión a internet e intenta de nuevo.` | "Backend" es justo la peor palabra para mostrar en la pantalla de pánico genérica — el usuario está estresado y no sabe qué es un backend. Se reemplaza por algo accionable que sí puede verificar (su conexión). |
| `frontend/app/error.tsx:14` | `Reintentar` | Sin cambio | Clara. |
| `frontend/components/shared/error-state.tsx:8` | `Reintentar` (default) | Sin cambio | Clara, ya se usa bien en cada pantalla con su propio título/descripción. |
| `frontend/components/shared/data-table.tsx:23` | `Sin datos` (default de `emptyTitle` cuando no se pasa uno específico) | `Sin datos por ahora` | Solo aplica a los pocos usos sin override (ver sección 6, `OrderDetail`); una vez agregados los overrides recomendados, este default casi no se usará, pero conviene que no suene tan cortante si algún caso queda sin cubrir. |
| `frontend/components/shared/confirm-dialog.tsx:29-35` | Botón único `Confirmar`, **sin botón de cancelar explícito** (solo se puede cerrar con clic afuera o Esc) | Agregar botón `Cancelar` junto al de confirmar; hacer el texto del botón de confirmar configurable por quien use el componente (`confirmLabel`), no fijo en `"Confirmar"` | Este componente es exactamente el que se necesita para el diálogo de "Confirmar pedido" (sección 5), pero hoy no tiene forma de decir "no, mejor no" de manera visible — solo cerrar accidentalmente. Un diálogo de confirmación sin botón de cancelar visible no cumple su propósito de frenar un error. Además, como es genérico y se va a usar para "confirmar pedido", "desactivar producto" y "cancelar pedido", el texto del botón de acción debe poder cambiar por contexto (`"Sí, confirmar y descontar stock"`, `"Sí, desactivar"`, etc.) en vez de decir siempre "Confirmar". |

---

## 13. Mensajes del backend que se muestran en la interfaz

Estos textos no viven en archivos `.tsx`/`.ts` del frontend (están en `backend/src/modules/**/*.service.ts`), así que quedan fuera del alcance de edición de este documento — pero se muestran tal cual en los `toast.error(...)` de la interfaz, así que están documentados aquí para que se coordinen con el mismo criterio.

| Origen | Texto actual | Texto sugerido | Por qué |
|---|---|---|---|
| `pedidos.service.ts:133` y `inventario.service.ts:48,104` | `Stock insuficiente para realizar este movimiento.` | Al confirmar un pedido: `No hay suficiente stock de {producto} para confirmar este pedido. Tienes {disponible} kg y el pedido pide {solicitado} kg.` Al registrar un movimiento de inventario: `No hay suficiente stock de {producto} para esta salida. Tienes {disponible} kg.` | Es el error que más importa de todo el sistema: aparece justo cuando el dueño intenta confirmar un pedido y no hay stock. El mensaje actual dice "este movimiento", una palabra que en el contexto de "Confirmar pedido" no tiene sentido para el usuario (él no está pensando en "movimientos", está confirmando un pedido). El payload de error ya trae `producto`, `solicitado_kg`, `disponible_kg` — se pueden interpolar. |
| `pedidos.service.ts:337` | `No se puede confirmar o completar un pedido cancelado` | `Este pedido está cancelado. No se puede confirmar ni marcar como entregado.` | Igual estructura, más hablado. |
| `pedidos.service.ts:341` | `No se puede cambiar el estado de un pedido cancelado` | `Este pedido está cancelado y ya no se puede modificar.` | Igual. |
| `pedidos.service.ts:345` | `No se puede cambiar el estado de un pedido completado` | `Este pedido ya se entregó y no se puede modificar.` | Usa "entregó" en vez de "completado" para ser consistente con el rename del botón (sección 5). |
| `pedidos.service.ts:108` | `El pedido no tiene productos para confirmar` | `Agrega al menos un producto antes de confirmar el pedido.` | Instrucción en vez de constatación. |
| `clientes.service.ts:98` | `Nombre de cliente requerido para pedidos del dashboard` | `Falta el nombre del cliente.` | Quita "pedidos del dashboard" (irrelevante para el usuario). |
| Patrón general (~15 mensajes tipo `'No se pudo actualizar el cliente'`, `'No se pudo crear el producto'`, etc.) | — | Agregar siempre un cierre de acción: `"... Intenta de nuevo."` o, si aplica, `"...Revisa los datos e intenta de nuevo."` | Ninguno de los mensajes actuales de este patrón le dice al usuario qué hacer después de leer el error — solo constatan que algo falló. |

---

## Reglas de voz

Para cualquier texto nuevo que se escriba en Pollito de aquí en adelante:

1. **Nunca uses una palabra que el dueño no diría en voz alta.** Si "backend", "webhook", "API" o un nombre de variable de entorno se le va a mostrar, ya perdiste — reescribe en lo que él sabe: pedidos, kilos, stock, clientes.
2. **El botón dice la consecuencia, no solo la acción.** "Confirmar" no es suficiente cuando confirmar descuenta stock real; "Confirmar y descontar stock" sí. Regla más fuerte para: dinero, stock, borrar algo, cancelar algo ya confirmado.
3. **Todo mensaje de error termina en un siguiente paso**, aunque sea corto ("Intenta de nuevo"). Nunca lo dejes en solo constatar que algo falló.
4. **Cero exclamaciones de sobra, cero emojis, cero "¡Genial!" ni "Ups".** Un tono plano y directo, como si el dueño le estuviera hablando a su encargado.
5. **Kilos, pesos y fechas siempre con su unidad o formato completo** ("20 kg", "$450.00", "3 de marzo"), nunca un número pelón que obligue a adivinar qué es.
6. **Las etiquetas de menú y de botón dicen el destino o la acción, no la categoría del sistema.** "Reglas del negocio" en vez de "Configuración" cuando aplique; "Nuevo pedido" en vez de "Crear registro".
7. **Nunca imprimas un valor interno crudo** (un enum, un UUID, un `snake_case`) directo en pantalla. Si el sistema guarda `whatsapp` o un id, la pantalla muestra su versión en español legible.
8. **Español mexicano neutro y corto.** Frases de una idea. Nada de "por favor procese su solicitud" ni relleno tipo plantilla de SaaS. Si suena a copy de landing page, bórralo y empieza de nuevo con lo que diría el dueño por teléfono.

---

## Pending Questions

1. **Rename de marca:** "Pollito Admin" → "Pollito" en `layout.tsx`, `top-navbar.tsx` y `mobile-menu.tsx`. Es un cambio de branding, no solo de copy — confirmar con el dueño del proyecto antes de aplicar.
2. **"Producto" vs. "corte":** en el giro del negocio, pechuga/pierna/muslo/ala/pata/pollo entero/retazo/hígado/molleja probablemente se llaman "cortes" en el habla diaria, no "productos". Si se confirma, el rename afecta título de página, botón "Nuevo producto", toasts y encabezados de tabla en toda la sección 7 — vale la pena decidirlo una sola vez y aplicarlo parejo.
3. **Tarjeta de WhatsApp en el dashboard y pantalla completa de WhatsApp:** hoy no miden nada real (estado fijo "Preparado"/"pendiente"). Recomendación de diseño (no solo copy): esconder ambas hasta que existan datos reales, en vez de mostrar estado de desarrollo disfrazado de funcionalidad. Si el negocio prefiere dejarlas visibles como "aviso de que viene", usar el copy honesto propuesto en la sección 11.
4. **Diálogo de confirmación en `order-status-actions.tsx`:** esto es una recomendación de interacción, no solo de texto — hoy "Confirmar" ejecuta sin ningún paso intermedio. Es, con diferencia, el cambio de mayor impacto de todo este documento y requiere tocar código, no solo copy.
5. **`ConfirmDialog` sin botón de cancelar:** el componente compartido necesita un botón de cancelar explícito y un `confirmLabel` configurable para poder usarse en el punto 4. Cambio de componente, no de copy.
6. **Interpolación de valores de configuración en el copy:** varios textos nuevos (secciones 4 y 10) asumen que el límite de mayoreo (hoy 50 kg) y los días de preparación se muestran con su valor real de `Configuración`, no como número fijo en el string. Confirmar que el componente que renderiza ese texto tiene acceso a esos valores.
7. **Doble descuento de stock (sección 9):** confirmar con quien conoce el flujo real si el tipo "venta" en el formulario de movimientos de inventario se usa alguna vez para ventas que sí pasaron por Pedidos (lo cual duplicaría el descuento) — el texto de ayuda propuesto asume que no debería pasar nunca.
