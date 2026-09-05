# Cómo se siente usar Báscula — y qué cambiaría

Documento distinto al de la auditoría. Aquel dice **qué está roto**; este dice
**qué funciona pero cuesta**, que es más difícil de ver porque nada falla.

La pregunta que me hice en cada pantalla fue la del negocio real: *son las 7 de
la mañana, hay camioneta esperando y el teléfono sonando. ¿Esta pantalla ayuda
o estorba?*

---

## Lo que la interfaz hace bien y conviene no perder

**El menú central.** Es lo único que te gustó desde el principio y tiene razón
de ser: con 8 secciones, el centro es el punto de menor recorrido del ojo desde
cualquier parte de la pantalla.

**El panel abre con lo que hay que hacer hoy.** "Pedidos por confirmar" arriba
y a la izquierda es la decisión correcta: la primera pantalla no es un resumen
del negocio, es una lista de trabajo pendiente.

**Decir que el stock no se mueve hasta confirmar.** Aparece en el pie del
formulario y en el resumen del bot. Es la regla más importante del sistema y
está donde se toma la decisión, no en un manual.

**Reportes admite lo que no sabe.** "Todo esto son ingresos, no ganancia" es
más valioso que un margen inventado.

---

## Los siete roces

### 1. El botón que más grita es el que destruye

En cada fila de pedidos: **Cancelar** en rojo relleno, **Confirmar** en
contorno gris.

El ojo va al color antes que a la posición o al texto. La acción que se hace
cincuenta veces al día queda apagada y la que se hace dos veces por semana —y
que además es difícil de deshacer— es la que resalta.

Peor con prisa: en una lista de seis pedidos idénticos, todos con el mismo par
de botones, el rojo funciona como imán. Un error aquí cancela un pedido real.

> **Cambio:** Confirmar en ámbar sólido (el color de acción del sistema),
> Cancelar como texto discreto. Y que Cancelar pida confirmación; hoy no
> pregunta.

### 2. Los números están gritados y las etiquetas susurradas

```
718                      ← 26 px
Kilos comprometidos      ← 11 px
Pedidos sin entregar     ← 11 px
```

Nadie recuerda de memoria qué son "kilos comprometidos". Sin poder leer la
etiqueta, el número grande no informa: alarma.

Es exactamente lo contrario de lo que pediste — que **con ver algo se entienda
qué es**, sin frases explicativas. Aquí la explicación existe pero es ilegible,
que es la peor combinación: ocupa espacio y no cumple.

> **Cambio:** etiqueta a 13-14 px con peso medio, número a 24 px. La distancia
> entre ambos sigue marcando la jerarquía; no hace falta que sea abismal.

### 3. Cinco columnas, dos con información

En Clientes: `DIRECCION` dice "Sin direccion" ocho veces. `NOTAS` dice "Sin
notas" ocho veces. `ESTADO` dice "activo" ocho veces.

Una columna llena de "Sin X" enseña la ausencia del dato, no el dato. Y empuja
lo que sí importa —nombre y teléfono— contra el borde izquierdo mientras el
centro de la pantalla se llena de gris.

> **Cambio:** quitar esas columnas de la tabla. La dirección y las notas
> aparecen al abrir el cliente, que es cuando importan. Si un cliente está
> inactivo, se marca con el nombre atenuado — no hace falta una columna para
> decir "todo normal".

Lo mismo en Productos: `ESTADO` "activo" ×9 más un badge "ok" junto al stock
que dice lo mismo otra vez.

### 4. El lápiz sin nombre contra el botón con texto

En Productos, cada fila ofrece:

```
✏️          Quitar del catalogo
```

La acción que se usa a diario no tiene nombre; la que se usa casi nunca tiene
etiqueta completa y ocupa el triple. Al escanear la fila, lo que se lee es
"Quitar del catálogo" — el sistema está anunciando la salida.

> **Cambio:** "Editar" con texto, y "Quitar" reducido a icono con tooltip.
> Invertir exactamente lo que hay hoy.

### 5. La pantalla vacía por abajo

Inventario con dos movimientos deja un tercio de pantalla en negro. El panel de
inicio estira la tarjeta de inventario 200 px para centrar un mensaje de
"todo bien".

Ya lo habías pedido antes. Vuelve a aparecer porque las listas cortas no tienen
plan: el diseño asume que siempre habrá datos.

> **Cambio:** cuando la lista es corta, que la tarjeta se ajuste a su contenido
> en vez de estirarse, y que el espacio sobrante lo tome la sección que sí
> tiene qué mostrar. En Inventario, con pocos movimientos, cabe perfectamente
> el resumen de existencias al lado.

### 6. "Kg limite rapido" no es como se piensa el negocio

En Reglas. Nadie piensa "mi límite rápido son 50 kg". Piensa *"de 50 kilos para
arriba ya es mayoreo y necesito dos días"*.

El campo obliga a traducir de tu cabeza al vocabulario del sistema. Y el texto
de ayuda debajo existe justo porque la etiqueta no se explica sola — que es la
señal de que la etiqueta está mal.

> **Cambio:** "A partir de cuántos kilos es mayoreo" y "Días de preparación
> para mayoreo". Con eso el texto de ayuda sobra, que era tu punto original.

### 7. El pedido no se puede revisar antes de guardarse

El formulario muestra `TOTAL DEL PEDIDO 12 kg · $1,140.00` (ahora que funciona)
y un botón Crear. Pero no se ve **si hay stock** para esos 12 kg hasta después
de guardar, cuando llega la advertencia.

El bot de WhatsApp sí lo revisa antes. La persona que captura a mano tiene
menos información que el cliente por WhatsApp.

> **Cambio:** que el selector muestre el stock junto al precio —
> `Pechuga · $95.00/kg · 80 kg` — y que se marque en ámbar si la cantidad pedida
> lo supera. Es prevención en el momento de decidir, no un aviso después.

---

## Sobre "¿esto funciona aquí o en otro apartado?"

Al recorrer todo, tres cosas están en el lugar equivocado:

**El movimiento de inventario debería poder hacerse desde Productos.** Cuando
llega mercancía, la cabeza está en "llegaron 100 kg de pechuga", no en
"registrar un movimiento". Hoy hay que ir a otra pantalla y volver a elegir el
producto que ya se estaba viendo.

**El stock debería verse al confirmar un pedido, no solo en Productos.** Es el
momento exacto en que importa.

**La pestaña de WhatsApp mezcla dos cosas distintas:** los chats que esperan a
una persona (trabajo urgente) y el simulador de pruebas (herramienta de
desarrollo). Con el negocio andando, el simulador es ruido en una pantalla que
debería ser una bandeja de pendientes. Convendría moverlo a Reglas, o
esconderlo detrás de un "modo pruebas".

---

## Si solo se puede hacer una cosa

**Subir la tipografía un escalón.** No cambia la estructura, no rompe nada, y
resuelve a la vez la legibilidad a distancia y la jerarquía invertida de los
KPI. Es media hora de trabajo en `tailwind.config.ts` y toca todas las
pantallas.

**Si se pueden hacer dos:** invertir el peso visual de Confirmar/Cancelar en la
lista de pedidos. Es el único roce de esta lista que puede costar un pedido
real.
