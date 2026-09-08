# Auditoría de la interfaz — lo bueno y lo malo

Revisión como si el sistema ya estuviera en producción: recorrido de las 8
pantallas, CRUD real contra la base, medición en el navegador (no a ojo) a
**1440×900**, **1366×768** y **375×812**.

Fecha: 5 de septiembre de 2026.

---

## Resumen

| | |
|---|---|
| Pantallas revisadas | 8 |
| **Fallos que impedían trabajar** | **2 — arreglados** |
| Problemas de diseño arreglados | 4 |
| Problemas de diseño pendientes | 6 |
| Desbordamientos horizontales | **0** |
| Elementos cortados por la pantalla | **0** |

Los dos fallos graves eran silenciosos: nada se rompía a la vista, simplemente
el trabajo no se podía completar o el dato mostrado era falso.

---

## 🔴 Fallos graves (arreglados en esta pasada)

### 1. El botón de guardar quedaba fuera de la pantalla

**Dónde:** todos los diálogos con formulario (pedido, producto, cliente,
movimiento de inventario).

**Qué pasaba:** el diálogo se limita a `max-h-[85dvh]` con scroll interno. En
**1366×768 — la resolución de portátil más común** — el botón "Crear pedido"
se renderizaba en `y = 842` con la ventana midiendo `768`. Medido:

```
viewport:      1366 × 768
botón Crear:   top 842, bottom 878
¿visible?      NO
```

El usuario llenaba el formulario completo y **no encontraba cómo enviarlo**.
Era alcanzable haciendo scroll dentro del diálogo, pero nada lo indicaba: la
barra de scroll interna es casi invisible sobre fondo oscuro.

**Arreglo:** el pie del formulario ahora va `sticky`, anclado abajo. El
contenido pasa por debajo y la acción está siempre visible.

Un detalle que costó dos intentos: `sticky bottom-0` se ancla al borde
**interior** del contenedor con scroll, no al visible. Dejaba una franja de
21 px por la que se asomaba el contenido y la ventana parecía rota. Se corrige
con `-bottom-4 sm:-bottom-5`, que iguala el padding del diálogo.

**Verificado después:** botón en `y = 698` sobre 768 → visible. En móvil
(375×812), `y = 800` sobre 812, hueco bajo el pie: `0 px`.

---

### 2. El total del pedido mostraba $0.00 siempre

**Dónde:** formulario de nuevo pedido.

**Qué pasaba:** con **12 kg de Pechuga a $95/kg** seleccionados, el resumen
seguía diciendo:

```
TOTAL DEL PEDIDO      1 kg · $0.00
```

No se actualizaba nunca. El usuario capturaba un pedido de $1,140 viendo cero,
y solo se enteraba del importe real **después de guardar**. En un negocio que
vende por kilo, mostrar un total falso mientras se captura es el peor dato que
puede haber en esa pantalla.

**Causa:** `watch('productos')` combinado con `useFieldArray` de
react-hook-form devuelve el valor inicial y no vuelve a emitir. Es un caso
conocido de la librería.

**Arreglo:** `useWatch({ control, name: 'productos' })`, que sí se suscribe al
control.

**Verificado después:** al elegir Pechuga → `1 kg · $95.00`. Al escribir 12 →
`12 kg · $1,140.00`.

---

## ✅ Lo que está bien

**Nada se corta ni se desborda.** Medido en las tres resoluciones: `scrollX =
0`, cero elementos fuera del viewport, cero contenedores con desbordamiento sin
scroll propio. La preocupación de que "unos marcos se pierden porque se cortan
con la pantalla" no se reproduce en ninguna pantalla — el problema real era el
botón oculto del punto 1, que es el mismo síntoma percibido.

**El CRUD funciona de punta a punta.** Se creó un pedido real por la interfaz
(cliente nuevo + producto + cantidad), apareció en la lista con su total
correcto y se borró después. Las 7 rutas GET responden 200.

**Móvil bien resuelto.** Las tablas se convierten en tarjetas por debajo de
768 px, y **ningún objetivo táctil baja de 44 px**. Los diálogos suben como
hoja pegada abajo, que es lo correcto para el pulgar.

**El selector de producto muestra el precio.** `Pechuga · $95.00/kg` dentro de
la lista evita ir y volver a la pantalla de productos.

**Reportes es honesto.** Dice explícitamente que son ingresos y no ganancia, y
por qué. Es mejor que inventar un margen.

**Accesibilidad de formularios.** Los campos usan `label` con `htmlFor` real,
`aria-describedby` para el error y `aria-invalid`. El diálogo usa el primitivo
`Title` de Radix, así que un lector de pantalla lo anuncia.

---

## 🟡 Problemas de diseño arreglados en esta pasada

### 3. La letra era demasiado chica — sobre todo la que explica

Medición de los tamaños en uso en el panel de inicio:

| Tamaño | Elementos | Qué es |
|---|---|---|
| **7.8 px** | 1 | la unidad "kg" del KPI |
| **10.2 px** | 1 | la unidad "kg" del KPI |
| **11 px** | 31 | *todas* las etiquetas de KPI y encabezados de tabla |
| 12 px | 14 | textos de apoyo |
| 13 px | 61 | **el cuerpo** |
| 17 px | 5 | títulos |
| 26 px | 1 | el número grande |

Dos cosas mal aquí:

**El `text-[0.6em]` de la unidad renderiza a 7.8 px.** No es legible a ninguna
distancia. Es un bug, no una decisión.

**La jerarquía está invertida.** El número mide 26 px y la etiqueta que dice
*qué significa ese número* mide 11 px. "718" grande y "Kilos comprometidos"
diminuto: se ve el dato pero no se sabe de qué es sin acercarse a la pantalla.

Para leer a un metro de distancia (que es donde está alguien de pie frente al
mostrador, no sentado), 11 px es insuficiente. La referencia habitual de cuerpo
es 16 px; aquí el cuerpo son 13.

**Y un problema de fondo:** subir la escala en `tailwind.config.ts` no movía
nada. Había **27 tamaños escritos a mano** (`text-[13px]`, `text-[11px]`,
`text-[10px]`) repartidos en 16 archivos — tabla, select, input, textarea,
todos los sitios donde de verdad vive el texto. Una escala que la mitad de los
componentes ignora no es una escala.

**Arreglo aplicado:**

```
2xs  11px → 12px      body  14px → 16px
xs   12px → 13px      + 27 tamaños sueltos unificados con la escala
sm   13px → 15px      + text-[0.6em] eliminado
base 14px → 16px      + alturas de boton: 28/32/36 → 32/36/40 px
```

**Medido después, en el mismo panel:**

| | Antes | Después |
|---|---|---|
| Elementos con ≤11 px | **33** | **0** |
| Cuerpo | 13 px (61 elementos) | 15 px (63 elementos) |
| Etiquetas de KPI | 11 px | 12 px |
| Unidad "kg" | **7.8 px** | 15 px |

Sin desbordamientos nuevos: `scrollX = 0` y cero elementos cortados en
1366×768, 1440×900 y 375×812. `next build` limpio.

### 4. La acción destructiva era la más llamativa

En la lista de pedidos, **"Cancelar" es un botón rojo relleno** y "Confirmar"
es de contorno. El elemento más visible de cada fila es el que destruye el
pedido; el que hace avanzar el trabajo pasa desapercibido.

Debería ser al revés: primario para confirmar, discreto para cancelar.

**Arreglo aplicado:** Confirmar pasa a `primary` (ámbar sólido) y Cancelar a
`danger-soft` — conserva el rojo, que es el significado, pero deja de gritar.
Ambas siguen pidiendo confirmación en un diálogo.

---

## 🟠 Problemas pendientes

### 5. Columnas que no dicen nada

En **Clientes**, con 8 registros:

- `DIRECCION` → "Sin direccion" ×8
- `NOTAS` → "Sin notas" ×8
- `ESTADO` → "activo" ×8

Tres de cinco columnas ocupan la mitad del ancho para comunicar cero. Lo mismo
en **Productos**, donde `ESTADO` dice "activo" en las 9 filas y hay además un
badge "ok" junto al stock que repite lo mismo.

Una columna cuyo valor es idéntico en todas las filas no es información: es
ruido que empuja lo importante hacia los lados.

### 6. "Editar" es un lápiz sin etiqueta; "Quitar del catálogo" sí tiene texto

En Productos y Clientes, la acción principal (editar) es un icono solo,
mientras la secundaria y destructiva lleva texto completo. La más usada es la
menos descubrible.

### 7. Pantalla desaprovechada en las listas cortas

En **Inventario** (2 movimientos) e **Inicio**, el contenido termina a media
altura y queda un tercio de pantalla vacío, mientras la tarjeta de "Inventario"
del panel estira su estado vacío por 200 px. El usuario ya pidió antes que se
aprovechara la pantalla.

### 8. El filtro de fecha es el control nativo del navegador

`dd/mm/aaaa` con el icono de calendario del sistema, sin el estilo del resto.
Rompe la coherencia visual y en Firefox/Safari se ve distinto.

### 9. La pantalla de Reglas usa otro lenguaje visual

`configuracion-form.tsx` es el único formulario que no pasó al sistema `Field`:
etiquetas de otro tamaño, ayudas bajo cada campo. Además "Kg limite rapido" es
jerga interna — el usuario no piensa en "límite rápido", piensa en "a partir de
cuántos kilos es mayoreo".

### 10. Falta acento en toda la interfaz

"Configuracion", "telefono", "direccion", "manana". Es consistente, así que no
parece error de una pantalla suelta, pero en producción se lee descuidado.

### 11. Los botones de navegación miden 28 px de alto

Por debajo de los 32 px que se recomiendan para puntero de ratón. En móvil está
resuelto (44 px), en escritorio no.

### 12. Quedan datos de prueba en la base

"PRUEBA Exceso" con un pedido de **500 kg / $47,500**, "PRUEBA Mayoreo",
"PRUEBA Claude", "Cliente WhatsApp". Distorsionan los reportes: ese pedido de
$47,500 es el 90% de los kilos comprometidos del panel.

---

## Cómo se midió

Todo lo anterior sale de ejecutar esto en cada pantalla, no de mirarla:

```js
// desbordamiento real de la página
document.documentElement.scrollWidth - document.documentElement.clientWidth

// elementos fuera del viewport
[...document.querySelectorAll('button,a,input,td,th')]
  .filter(el => { const r = el.getBoundingClientRect();
                  return r.width && (r.right > innerWidth || r.left < 0); })

// reparto real de tamaños de letra en texto visible
// contenedores que desbordan sin overflow propio
// altura de cada objetivo táctil
```

Reproducible: abrir cualquier pantalla y pegarlo en la consola.

---

# Segunda auditoría — jerarquía y estructura

Fecha: 8 de septiembre de 2026. Encargo explícito: **no tocar color ni
tipografía**, revisar la jerarquía de las tablas y la estructura.

Método: evaluación de diseño en un agente aislado + evidencia determinista
(detector mecánico y medición en el navegador). El detector salió limpio.
Cada hallazgo se comprobó midiendo antes de tocar código.

Puntuación Nielsen: **24/40 → 26/40** tras los arreglos.

## Lo que se encontró y se arregló

### Contenido inalcanzable (P0)

**WhatsApp.** `fill` apaga el scroll de `PageShell`, y el hijo no tenía el
suyo. Medido a 1440×900: el contenido llegaba a `y=1448` mientras la página y
el contenedor medían 900 y 840. **608 px imposibles de ver**, incluido el panel
entero de "Probar el asistente". No cortado a medias: inalcanzable.

**Reportes en móvil.** La barra de página era de alto fijo, con las acciones en
`shrink-0` y sin salto de línea. Con 11 controles, el grupo medía **880 px en
un viewport de 375** y `scrollWidth` seguía siendo 375: recortado, no
desplazable. Los ocho botones de periodo quedaban fuera y el `<h1>` aplastado a
ancho cero.

> La lección: `fill` y las barras de alto fijo son trampas silenciosas. No
> avisan, no desbordan y no scrollean — simplemente esconden. Al revisar una
> pantalla nueva, medir `scrollHeight` contra el fondo real del contenido, no
> solo el desbordamiento horizontal.

### Orden por la base de datos, no por el trabajo

La lista de pedidos venía por `created_at desc`. Salía `10 sep, 7 sep, sin
fecha, sin fecha, 4 sep, 4 sep, 6 sep`: un pedido con tres días de retraso
sepultado a media lista. Nadie abre esa pantalla preguntando "¿cuál anoté al
último?". Ahora ordena por fecha de entrega y marca **Atrasado** y **Hoy**.

### Pantallas que se contradicen

Reportes decía "captura el costo por kilo en **Productos**" y Productos no
mostraba el costo: para saber a cuáles les faltaba había que abrir el
formulario de los nueve. Se añadieron **Costo** y **Margen**.

El filtro decía `completado` mientras la insignia de la misma fila decía
`entregado`. Una sola fuente de etiquetas.

### Listas que se repasaban en vez de trabajarse

Sin selección múltiple, sin ordenar por columna y sin atajos: cinco pedidos
eran diez interacciones. Ahora hay lote, orden por columna (con vuelta al orden
natural al tercer toque) y `/` y `n`.

### `next lint` no estaba mirando el front

Solo revisa `app/`, `components/`, `lib/`, `pages/` y `src/` por defecto. Al
mover el front a `client/`, dejó de cubrirlo **sin avisar**. Los "lint limpio"
anteriores eran ciertos y vacíos. Se declaran las carpetas en
`next.config.mjs`, y una regla de ESLint impide que `client/` importe de
`server/` o al revés.

## Lo que queda

- **Sin persistencia de filtros.** Al volver de una interrupción se pierde el
  filtro, la búsqueda, el periodo y la conversación abierta. Todo vive en
  `useState`, sin URL ni `sessionStorage`.
- **Inventario y Productos no tienen búsqueda.** Pedidos es la única con
  filtros. Para responder "¿qué pasó con la pechuga?" hay que escanear.
- **El libro de movimientos no lleva saldo corrido**, así que no permite
  auditar cómo se llegó al stock actual. Y `Cantidad` no lleva signo: una
  entrada de 5 kg y una venta de 60 kg se ven igual.
- **El esqueleto de carga no se parece a lo que carga**, así que funciona como
  un salto de layout con pasos extra.
- **`Card` + `CardContent` sigue siendo redundante** en Configuración y
  WhatsApp. Las pantallas que meten la tabla directo en el `Card` se ven mejor.
- **`Cerrar sesión` no pide confirmación** y está en la zona del pulgar.
