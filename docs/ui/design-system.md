# Pollito — Sistema de diseño

**Dirección: PAPEL DE BÁSCULA.**
Tinta sobre papel de contabilidad. Una sola dirección, sin alternativas.

Documento normativo. Todo valor aquí es una decisión tomada, no una sugerencia.
Otro agente implementa a partir de este archivo.

---

## 0. La dirección, y por qué

El mundo del sujeto no es "SaaS". Es una distribuidora avícola: notas de remisión,
tickets de báscula, sellos de hule, cajas de plástico apiladas, libretas de rayas,
etiquetas de precio pintadas a mano.

La UI es **tinta impresa sobre papel**. Concretamente:

1. **Papel de contabilidad rayado (*greenbar*).** Las filas alternadas de las tablas
   llevan la barra verde pálida del papel contable clásico. No es decoración: la barra
   codifica la alternancia de fila, que es exactamente para lo que se inventó. Este es
   el **elemento firma** del proyecto. En oscuro la misma barra se vuelve un verde
   fósforo apagado — el hilo verde une los dos temas.
2. **Radio cero. Sin excepciones.** Las esquinas cuadradas son la mitad del retro-minimal.
3. **Sombra dura desplazada, cero blur.** Lee como un trabajo de impresión a dos tintas
   ligeramente fuera de registro. La sombra difusa es el tell #1 de plantilla de IA.
4. **Las reglas hacen la estructura, no las superficies.** Filetes de 1px separan todo,
   como una libreta rayada. Nada "flota".
5. **Los números son el héroe.** Es un dashboard operativo: tabular-nums obligatorio,
   monoespaciada para las cifras grandes.
6. **El estado no es una píldora, es un sello.** Texto en versalitas dentro de una caja
   dura de 1px, con tinta de color.

### Lista negra (lo que se elimina del código actual)

| Se borra | Dónde vive hoy | Se reemplaza por |
|---|---|---|
| `rounded-full`, `rounded-2xl`, `rounded-3xl` | `button.tsx`, `badge.tsx`, `globals.css .premium-card`, `top-navbar.tsx`, `metric-card.tsx` | radio `0` |
| `backdrop-blur-md` | `top-navbar.tsx` header | fondo sólido `--paper` + filete inferior de 2px |
| `shadow-soft` (`0 16px 50px rgba(...)`) | `tailwind.config.ts`, `.premium-card` | `--shadow-print` (offset duro, blur 0) |
| `.premium-card` como nombre | `globals.css` | `.sheet` (hoja) |
| Badges de píldora con fondo `/10` | `badge.tsx`, `status-badge.tsx` | sellos cuadrados de 1px |
| Iconos `lucide-react` en la UI | `constants.ts`, `metric-card.tsx`, `top-navbar.tsx` | set SVG propio de §5 |
| `font-geist-sans` / Inter | `globals.css`, `tailwind.config.ts` | Archivo / Archivo Narrow / Space Mono |
| `h-12` header + `py-4` celdas (≈52px por fila) | `table.tsx` | 32px header / 36px fila |

### Lo que se conserva

**El menú centrado.** Es lo único que el usuario aprueba. Se conserva *y se arregla*:
hoy está centrado por accidente (`justify-between` con tres hijos de ancho variable).
Pasa a grid de 3 columnas `[1fr auto 1fr]` para que quede **ópticamente centrado**
sin importar cuánto crezca el email del usuario a la derecha. Ver §7.

---

## 1. Paleta

Contrastes verificados contra WCAG 2.1. Cada par declarado abajo cumple AA (≥4.5:1
texto normal, ≥3:1 elementos no textuales) — el ratio real va anotado.

### 1.1 Claro — "nota de remisión"

```css
:root {
  /* Sustrato */
  --background:            44 33% 96%;   /* #F8F6F1  papel */
  --foreground:            30 12%  9%;   /* #1A1714  tinta offset (16.5:1) */
  --card:                  48 33% 99%;   /* #FDFDFC  hoja fresca */
  --card-foreground:       30 12%  9%;

  /* Texto secundario */
  --muted:                 42 20% 91%;   /* #EDEAE3  manila (superficie) */
  --muted-foreground:      32  9% 34%;   /* #5F574F  (6.6:1 sobre papel) */
  --secondary:             42 20% 91%;
  --secondary-foreground:  30 12%  9%;
  --accent:                42 24% 87%;   /* #E6E1D6  hover de superficie */
  --accent-foreground:     30 12%  9%;

  /* Estructura */
  --border:                32 12% 55%;   /* #9A8D7E  filete estructural (3.0:1) */
  --rule:                  34 14% 78%;   /* #CFC7BB  filete interno de tabla */
  --input:                 32 12% 55%;
  --ring:                  30 12%  9%;   /* foco = tinta */

  /* FIRMA: papel contable */
  --bar:                  104 22% 86%;   /* #D8E3D3  greenbar (tinta 13.5:1) */

  /* Marca */
  --primary:               44 96% 52%;   /* #FABB0F  yema (tinta encima 10.3:1) */
  --primary-foreground:    30 12%  9%;

  /* Tintas semánticas — todas AA sobre papel */
  --success:              146 68% 26%;   /* #156F3C  (5.8:1) */
  --warning:               24 88% 35%;   /* #A84A0B  naranja quemado (5.3:1) */
  --danger:                 4 76% 44%;   /* #C5261B  rojo de sello (5.3:1) */
  --info:                 212 78% 34%;   /* #13529A  azul de báscula (7.2:1) */
  --on-danger:              0  0% 100%;  /* blanco sobre danger = 5.7:1 */

  /* Sombra impresa */
  --shadow-ink:            30 12%  9%;
  --radius:                 0px;
}
```

### 1.2 Oscuro — "papel carbón"

No es un dark de SaaS azulado. Es una plancha de tinta **cálida**: el negativo del
papel. La barra contable sobrevive como un verde fósforo apagado.

```css
.dark {
  --background:            30  8%  8%;   /* #161413  plancha de tinta */
  --foreground:            44 28% 92%;   /* #F0EDE5  papel (15.7:1) */
  --card:                  30  8% 11%;   /* #1E1C1A */
  --card-foreground:       44 28% 92%;

  --muted:                 30  7% 15%;   /* #292523 */
  --muted-foreground:      40 10% 65%;   /* #AFA99D  (7.9:1) */
  --secondary:             30  7% 15%;
  --secondary-foreground:  44 28% 92%;
  --accent:                32  8% 19%;   /* #34302C  hover */
  --accent-foreground:     44 28% 92%;

  --border:                36  8% 42%;   /* #746D63  (3.6:1) */
  --rule:                  36  7% 28%;   /* #4C4741 */
  --input:                 36  8% 42%;
  --ring:                  44 28% 92%;   /* foco = papel */

  --bar:                  140 14% 14%;   /* #1F2922  greenbar en fósforo */

  --primary:               44 92% 62%;   /* #F7C845  yema (tinta encima 11.6:1) */
  --primary-foreground:    30 10%  8%;

  --success:              148 56% 52%;   /* #40C980  (8.7:1) */
  --warning:               28 90% 60%;   /* #F5933D  (8.0:1) */
  --danger:                 6 84% 64%;   /* #F06656  (5.9:1) */
  --info:                 210 84% 66%;   /* #5FA8F1  (7.3:1) */
  --on-danger:             30 10%  8%;

  --shadow-ink:            36  8% 42%;   /* la sombra dura se vuelve gris cálido */
}
```

### 1.3 Reglas de uso del color

- **El color nunca es la única señal.** El item de nav activo lleva fondo yema **y**
  filete inferior de tinta de 2px. El sello de estado lleva color de tinta **y** texto.
  La fila de tabla en hover lleva fondo **y** marcador lateral. (`color-not-only`)
- **Yema = una sola cosa: la acción primaria y la ubicación actual.** Nada más se pinta
  de amarillo. Su contraste contra papel es 1.6:1, así que jamás se usa como filete fino
  aislado ni como texto.
- **Prohibido:** cualquier gradiente, `backdrop-filter`, superficie translúcida sobre
  translúcida, morado, índigo, y colores `/10` de fondo para badges.
- `--bar` se usa **solo** en filas impares de tabla y en el fondo del `<thead>`. Si se
  usa en una card pierde su significado.

---

## 2. Tipografía

Tres roles, dos personalidades. Una sola superfamilia para la UI (Archivo + Archivo
Narrow) y una monoespaciada de carácter para las cifras. Es la disciplina de un sistema
de señalética real: una familia, dos anchos.

### 2.1 Carga (next/font)

```ts
// app/layout.tsx
import { Archivo, Archivo_Narrow, Space_Mono } from 'next/font/google';

export const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
  axes: [] // variable: 100–900 incluido
});

export const archivoNarrow = Archivo_Narrow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap'
});

export const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-num',
  display: 'swap'
});

// <html className={`${archivo.variable} ${archivoNarrow.variable} ${spaceMono.variable}`}>
```

| Rol | Familia | Para qué |
|---|---|---|
| `--font-ui` | **Archivo** | Todo el texto de interfaz, body, botones, formularios, celdas de tabla. Grotesca industrial con buena mancha a 13px. |
| `--font-display` | **Archivo Narrow** | Títulos de página, títulos de card, y etiquetas de plantilla en versalitas. El ancho condensado es lo que usa la señalética de precio real. |
| `--font-num` | **Space Mono** | **Solo** cifras grandes (KPI, total de pedido) y sellos de estado. Mono grotesca de los 60 — es carácter puro, por eso se raciona. |

**Por qué Space Mono no va dentro de las tablas:** es ancha; en una tabla densa
desperdicia horizontal. Las columnas numéricas usan **Archivo con figuras tabulares**,
que ya resuelve la alineación sin costo de ancho.

### 2.2 Escala

Dashboard operativo → base 14px, no 16. Los `<input>` suben a 16px bajo `md` para
evitar el auto-zoom de iOS.

| Token | px | line-height | tracking | weight | Familia | Uso |
|---|---|---|---|---|---|---|
| `--text-2xs` | 11 | 14 | `+0.09em` | 600 | display | Etiquetas de plantilla, `<th>`, eyebrows. **Siempre uppercase.** |
| `--text-xs` | 12 | 16 | `+0.01em` | 400 | ui | Meta, ayuda, timestamps |
| `--text-sm` | 13 | 18 | `0` | 400 | ui | Celdas de tabla, UI secundaria |
| `--text-base` | 14 | 20 | `0` | 400 | ui | Body, valores de formulario, botones |
| `--text-md` | 16 | 22 | `-0.005em` | 500 | ui | Título de card, `<input>` en móvil |
| `--text-lg` | 20 | 24 | `-0.012em` | 600 | display | Encabezado de sección |
| `--text-xl` | 26 | 28 | `-0.018em` | 700 | display | Título de página |
| `--text-2xl` | 34 | 34 | `-0.022em` | 700 | num | Cifra secundaria |
| `--text-3xl` | 46 | 44 | `-0.028em` | 700 | num | KPI principal |

**Tracking dependiente del tamaño** — un solo `letter-spacing` global está mal en algún
lado. Texto grande: negativo. Texto chico en versalitas: muy positivo. Body: 0.

### 2.3 Números — obligatorio

```css
/* Todo lo que sea cifra */
.num,
td[data-numeric],
th[data-numeric],
input[type='number'] {
  font-variant-numeric: tabular-nums lining-nums slashed-zero;
  font-feature-settings: 'tnum' 1, 'lnum' 1, 'zero' 1;
  text-align: right;              /* dinero y cantidades: siempre a la derecha */
  font-variant-ligatures: none;
}

.num-hero {
  font-family: var(--font-num), ui-monospace, monospace;
  font-variant-numeric: tabular-nums slashed-zero;
  letter-spacing: -0.028em;
}
```

- **Cero rayado** (`slashed-zero`): en un dashboard de inventario distingue `0` de `O`.
  Además es puro papel de impresora de matriz de puntos — refuerza la dirección.
- Formato: `Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' })` para dinero,
  `Intl.NumberFormat('es-MX')` para conteos. Nunca concatenar `'$' + n`.
- Las columnas numéricas van alineadas a la derecha; sus `<th>` también.

### 2.4 Base

```css
html { font: 400 14px/1.45 var(--font-ui), ui-sans-serif, system-ui, sans-serif; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

.label-stencil {           /* la etiqueta de plantilla, en toda la UI */
  font-family: var(--font-display);
  font-size: 11px; line-height: 14px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
```

Todo el espaciado interno se declara en `rem`/`em`, nunca px fijos alrededor de texto,
para que el usuario pueda subir el tamaño de fuente del sistema sin romper el layout.

---

## 3. Forma, borde y sombra

### 3.1 Radio

```
--radius: 0px;
```

**Cero en absolutamente todo:** botones, inputs, cards, diálogos, selects, avatares,
skeletons, toasts, el logo. Una sola excepción declarada: el **punto de estado** de 6px
(`border-radius: 9999px`), porque un punto cuadrado de 6px se lee como un artefacto.

En `tailwind.config.ts` hay que **anular toda la escala**, no solo extenderla:

```ts
theme: {
  borderRadius: {
    none: '0px', sm: '0px', DEFAULT: '0px', md: '0px',
    lg: '0px', xl: '0px', '2xl': '0px', '3xl': '0px',
    full: '0px',            // mata rounded-full donde sobreviva
    dot: '9999px'           // única excepción: rounded-dot
  },
  extend: { /* ... */ }
}
```

### 3.2 Grosor de borde

Dos grosores. Ninguno fraccionario (1.5px es borroso a 1x).

| Grosor | Token | Dónde |
|---|---|---|
| **2px** | `--bw-ink` | Contención: card, diálogo, input, botón outline, borde inferior del header, item de nav activo |
| **1px** | `--bw-rule` | Filetes internos: divisor de fila de tabla, separator, borde de sello, divisor vertical del nav |

Los filetes internos usan `--rule` (más claro). Los bordes de contención usan `--border`.
La distinción es lo que evita que la UI se vea como una reja.

### 3.3 Sombra — offset duro, blur cero

```css
:root {
  --shadow-sm:   2px 2px 0 0 hsl(var(--shadow-ink));   /* botón, sello, chip */
  --shadow-md:   4px 4px 0 0 hsl(var(--shadow-ink));   /* card, popover */
  --shadow-lg:   6px 6px 0 0 hsl(var(--shadow-ink));   /* diálogo modal */
  --shadow-none: 0 0 0 0 hsl(var(--shadow-ink));
}
```

Reglas:

- **Blur 0 y spread 0, siempre.** Un `box-shadow` con blur en este proyecto es un bug.
- Desplazamiento siempre positivo en X e Y (abajo-derecha), como una impresión fuera de
  registro. Nunca sombra centrada ni hacia arriba.
- El color de sombra es `--shadow-ink` (tinta en claro, gris cálido en oscuro). El
  **botón primario** es la excepción: su sombra es `hsl(var(--foreground))` en ambos temas,
  para que el par yema+tinta lea como una etiqueta impresa.
- La sombra es **interactiva, no decorativa**: existe para colapsarse al presionar (§6.5).
  Elementos que no se pueden presionar (un `<section>`, un skeleton) no llevan sombra.

### 3.4 Componentes clave

```css
@layer components {
  /* Reemplaza a .premium-card */
  .sheet {
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    border: var(--bw-ink) solid hsl(var(--border));
    border-radius: 0;
    box-shadow: var(--shadow-md);
  }

  /* Sello de estado — reemplaza a Badge de píldora */
  .stamp {
    display: inline-flex; align-items: center; gap: 5px;
    height: 20px; padding: 0 6px;
    border: var(--bw-rule) solid currentColor;
    font-family: var(--font-num);
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    background: transparent;                 /* nada de fondos /10 */
  }
  .stamp[data-tone='ok']       { color: hsl(var(--success)); }
  .stamp[data-tone='pending']  { color: hsl(var(--warning)); }
  .stamp[data-tone='info']     { color: hsl(var(--info)); }
  .stamp[data-tone='danger']   { color: hsl(var(--danger)); }

  /* Foco: recuadro de selección, no anillo suave */
  :where(a, button, input, select, textarea, [tabindex]):focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
    border-radius: 0;
  }
}
```

---

## 4. Espaciado y densidad

Esto es una herramienta de trabajo, no una landing. La densidad es un requisito, no un
gusto. Objetivo: **una pantalla de 1080px de alto muestra ≥18 filas de pedido sin scroll.**

### 4.1 Escala (base 4)

```
0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48
```

Nada fuera de esta escala. Sin `p-5`, sin `gap-7`.

### 4.2 Valores exactos

| Elemento | Valor | Antes (actual) |
|---|---|---|
| Gutter de página | `16px` móvil / `24px` ≥md | `16 / 24 / 32` |
| Padding vertical de página | `20px` | `24px` |
| Alto del header | `52px` | `64px` |
| Padding de card (`.sheet`) | `16px`; header interno `12px 16px` | `20–24px` |
| Gap de grid de KPIs | `12px` móvil / `16px` ≥md | ~`24px` |
| Alto de card KPI | `88px` fijo | ~`140px` |
| Separación entre bloques | `24px` | variable |
| Separación antes de sección nueva | `32px` + filete de 1px | — |
| **`<thead>` alto de fila** | `32px`, padding `0 12px` | `48px` |
| **`<tbody>` alto de fila** | `36px`, padding `8px 12px` | ~`52px` |
| Alto de input / select | `34px`; `40px` en móvil | `40px` |
| Alto de botón `sm / md / lg` | `28 / 34 / 40px` | `36 / 40 / 44px` |
| Botón de icono | `30px` visual | `40px` |
| Tamaño de icono | `16px` (nav, tabla, botón), `20px` (KPI) | `16–20px` mixto |
| Gap icono↔texto | `8px` | `8px` |
| Ancho máximo de contenido | `1600px` | `max-w-screen-2xl` (ok) |

### 4.3 Densidad vs. accesibilidad táctil

Las filas de 36px están por debajo de los 44px táctiles — a propósito, es una herramienta
de escritorio. Las reglas que lo compensan:

- **La fila completa es el destino de click** (no un link de 13px dentro de ella). El
  `<tr>` lleva `cursor: pointer` y navega al detalle.
- Los botones de acción dentro de la fila tienen **28px visuales y 44px de área de golpe**
  vía `padding` + `margin` negativo, nunca reduciendo el hit area.
- Por debajo de `768px` la tabla **no hace scroll horizontal**: se transforma en lista de
  fichas apiladas, con destinos de 44px. Es un cambio de layout, no un `overflow-x`.

### 4.4 Ritmo

- Contenido relacionado: `8px`. Grupos dentro de una card: `12px`. Entre cards: `16px`.
  Entre secciones: `24px`. Antes de un nuevo encabezado: `32px`.
- **La regla del filete:** todo cambio de sección se marca con `border-top: 1px solid
  hsl(var(--rule))` más `24px` de aire arriba y `16px` abajo. El aire asimétrico ata el
  filete al contenido que sigue.
- Nunca dos superficies con borde anidadas (card dentro de card). Si hay que agrupar
  dentro de una card, se usa un filete, no otra caja.

---

## 5. Iconos

### 5.1 La decisión

**SVG propios, 16×16, geométricos, trazo 1.5, terminales cuadradas.** Se descarta todo
lo demás:

- **Pixel-art 16×16** — se lee como videojuego de 8 bits. Ese es el retro equivocado:
  el nuestro es impresión y señalética de los 70, no arcade. Además no puede heredar
  grosor de trazo ni escalar a 20px sin romperse.
- **Librería con look retro** — no existe. Lucide, Heroicons, Phosphor, Tabler y Feather
  comparten exactamente la misma gramática (grid de 24, trazo 2, `stroke-linecap="round"`).
  Es justamente el look que el usuario rechazó; cambiar de librería no cambia nada.
- **SVG propios** — 12 archivos de ~200 bytes, heredan `currentColor`, y el detalle que
  los saca del genérico es una sola decisión: **terminales y uniones cuadradas**. Lucide
  redondea todo; nosotros no redondeamos nada. Eso, más geometría deliberadamente
  imperfecta (barras desiguales, faders a distinta altura), es lo que se lee como
  "dibujado a mano" en vez de generado.

### 5.2 Contrato

```
viewBox="0 0 16 16"   fill="none"   stroke="currentColor"
stroke-width="1.5"    stroke-linecap="square"   stroke-linejoin="miter"
```

- Coordenadas ancladas a `.25` / `.75` para que el trazo de 1.5 caiga nítido a 16px.
- Se renderizan a **16px** o **32px**. Nada intermedio.
- Ningún icono va solo: siempre acompañado de texto o `aria-label`.
- Un único set. Prohibido mezclar con lucide "solo para este caso".

Componente base:

```tsx
// components/icons/icon.tsx
export function Icon({ size = 16, ...p }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="square" strokeLinejoin="miter"
      shapeRendering="geometricPrecision" aria-hidden focusable="false" {...p}
    />
  );
}
```

### 5.3 El set

#### `IconDashboard` — pizarrón de control

Marco con tres barras de altura desigual. No es la retícula de 4 cuadros genérica.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.25 2.25h11.5v11.5h-11.5z"/>
  <path d="M5 11.25V7.75"/>
  <path d="M8 11.25V4.75"/>
  <path d="M11 11.25V9.25"/>
</svg>
```

#### `IconPedidos` — nota de remisión

Ticket con el borde inferior dentado, como papel arrancado de la báscula.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M3.25 2.25h9.5v9.25l-1.58 1.25-1.59-1.25-1.58 1.25-1.59-1.25-1.58 1.25-1.58-1.25z"/>
  <path d="M5.75 5.5h4.5"/>
  <path d="M5.75 7.75h3"/>
</svg>
```

#### `IconProductos` — caja de plástico apilable

Cajón cónico con banda y ranura de agarre. Es literalmente el objeto del negocio.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.5 4.25h11l-1 9.25h-9z"/>
  <path d="M2.85 7.75h10.3"/>
  <path d="M6.5 5.9h3"/>
</svg>
```

#### `IconClientes` — ficha de cliente

Tarjeta con cabeza cuadrada, hombros rectos y dos renglones. Nada de círculo + arco.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.25 3.25h11.5v9.5h-11.5z"/>
  <path d="M5 5.75h2.5v2.5h-2.5z"/>
  <path d="M3.9 10.75v-.75h4.7v.75"/>
  <path d="M10 6.5h2.5"/>
  <path d="M10 9h2"/>
</svg>
```

#### `IconInventario` — anaquel con existencia desigual

Tres entrepaños; la mercancía de cada uno tiene distinta longitud. El icono *dice* el
dato, no lo decora.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.25 2.25h11.5v11.5h-11.5z"/>
  <path d="M2.25 6.1h11.5"/>
  <path d="M2.25 9.95h11.5"/>
  <path d="M4.25 4.35h3.5"/>
  <path d="M4.25 8.2h6"/>
  <path d="M4.25 12.05h2"/>
</svg>
```

#### `IconConfiguracion` — tres faders

**No es un engrane.** El engrane es el icono más genérico que existe. Tres deslizadores
de consola a distinta altura: control panel de los 70, y comunica "ajustes" mejor.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M4 2.5v11"/>
  <path d="M8 2.5v11"/>
  <path d="M12 2.5v11"/>
  <path d="M2.6 5.5h2.8"/>
  <path d="M6.6 9.75h2.8"/>
  <path d="M10.6 7.25h2.8"/>
</svg>
```

#### `IconWhatsapp` — globo de diálogo cuadrado

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.25 2.75h11.5v7.75h-7.25l-2.5 2.75v-2.75h-1.75z"/>
  <path d="M5.25 5.75h5.5"/>
  <path d="M5.25 7.9h3.5"/>
</svg>
```

> **Regla de marca:** este icono se usa en la **navegación**, siempre con la etiqueta
> "WhatsApp" al lado. Donde haya un CTA que *abre* WhatsApp (`wa.me/...`) se usa el
> glifo oficial de WhatsApp con su verde oficial `#25D366`, sin modificar proporciones.
> Redibujar una marca registrada en estilo propio es correcto para navegación interna,
> incorrecto para un botón que representa el servicio.

#### `IconAgregar` — sello de más

Cruz de terminales cuadradas dentro de un recuadro. Se lee como un sello de hule.

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.25 2.25h11.5v11.5h-11.5z"/>
  <path d="M8 4.75v6.5"/>
  <path d="M4.75 8h6.5"/>
</svg>
```

#### Extras necesarios para el chrome

`IconBuscar` — lupa cuadrada:

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.75 2.75h7.5v7.5h-7.5z"/>
  <path d="M10.25 10.25l3 3"/>
</svg>
```

`IconSalir` — puerta y flecha:

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M9.75 2.75h3.5v10.5h-3.5"/>
  <path d="M2.75 8h6"/>
  <path d="M6.25 5.25l2.75 2.75-2.75 2.75"/>
</svg>
```

`IconTema` — sol cuadrado:

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M5.75 5.75h4.5v4.5h-4.5z"/>
  <path d="M8 1.75v1.75"/>
  <path d="M8 12.5v1.75"/>
  <path d="M1.75 8h1.75"/>
  <path d="M12.5 8h1.75"/>
  <path d="M3.4 3.4l1.25 1.25"/>
  <path d="M11.35 11.35l1.25 1.25"/>
</svg>
```

`IconCheck` — palomita de sello (para estados completados):

```svg
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M2.75 8.25l3.25 3.25 7.25-7.25"/>
</svg>
```

### 5.4 Migración

`lib/constants.ts` deja de importar de `lucide-react`. `navItems` pasa a referenciar
los componentes de `components/icons/`. `lucide-react` sale de `package.json` una vez
que no queden importaciones.

---

## 6. Movimiento

Librería: **framer-motion**. Personalidad: **Corporativa con carácter mecánico** — el
papel y la tinta no rebotan.

### 6.1 Constantes

```ts
// lib/motion.ts
export const DUR = {
  instant: 0,        // feedback de presión: se ve en el mismo frame
  quick:   0.12,     // 120ms — hover, marcadores
  base:    0.20,     // 200ms — cambios de estado, diálogos
  enter:   0.26,     // 260ms — entrada por scroll
  page:    0.24,     // 240ms — entrada de página
  count:   0.70      // 700ms — conteo de KPI
} as const;

export const EASE = {
  standard:   [0.20, 0.00, 0.00, 1.00], // firma de la casa, 80% de los casos
  decelerate: [0.05, 0.70, 0.10, 1.00], // entradas
  accelerate: [0.30, 0.00, 1.00, 1.00]  // salidas
} as const;

export const STAGGER = 0.04;      // 40ms
export const STAGGER_MAX = 6;     // se congela después del 6º elemento
```

**Overshoot: 0%. Bounce: 0. Spring: ninguno.** Justificación explícita: el rebote es el
tell más obvio de la animación de plantilla, y contradice la materialidad (papel impreso).
La única "física" del sistema es el desplazamiento del botón hacia su propia sombra (§6.5).

### 6.2 Entrada de página

Una sola coreografía, ejecutada en el layout de contenido, no por página.

```tsx
const pageEnter = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.page, ease: EASE.decelerate } }
};
```

- Solo `opacity` + `y: 8px`. Sin `scale` (el papel no se acerca a la cámara).
- El filete de 2px bajo el header hace `scaleX: 0 → 1` con `transformOrigin: 'left'`,
  `320ms`, `EASE.standard`. Es el gesto de "imprimir" la página.
- Presupuesto total: **≤ 400ms**. Nada de la primera vista aparece después de eso.

### 6.3 Aparición por scroll

```tsx
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, amount: 0.25, margin: '0px 0px -10% 0px' }}
  variants={{
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: {
        duration: DUR.enter,
        ease: EASE.decelerate,
        delay: Math.min(i, STAGGER_MAX) * STAGGER   // el stagger se congela
      }
    })
  }}
  custom={index}
/>
```

- **Stagger 40ms, tope 6 elementos.** Un `staggerChildren` sin tope en una tabla de 40
  filas produce 1.6s de espera; con el tope, el presupuesto total es **≤ 460ms**.
- `once: true` — nada re-anima al volver a subir. Una animación que se repite en cada
  scroll es ruido.
- `amount: 0.25` con margen negativo del 10%: el elemento empieza a aparecer justo antes
  de estar completamente visible.
- **Segundo dispositivo de scroll, el que da carácter:** el filete que abre cada sección
  hace `scaleX: 0 → 1` desde la izquierda, `400ms`, `EASE.standard`. La página se
  *imprime* renglón por renglón al bajar. Es el único efecto de scroll decorativo
  permitido y es coherente con la dirección.
- **Nada de parallax, nada de fondos en movimiento, nada de blur animado.**
- Las filas de tabla ya visibles en el primer render **no** animan por scroll: renderizan
  en su estado final. Solo animan las que entran después.

### 6.4 Hover de fila de tabla

```tsx
// El fondo cambia en el mismo frame — el retardo mata la sensación de directo.
// La animación la lleva el marcador lateral.
<tr className="group cursor-pointer hover:bg-[hsl(var(--accent))]">
  <td className="relative">
    <motion.span
      className="absolute left-0 top-0 h-full w-[2px] bg-[hsl(var(--primary))] origin-top"
      initial={{ scaleY: 0 }}
      animate={{ scaleY: hovered ? 1 : 0 }}
      transition={{ duration: hovered ? DUR.quick : 0.10, ease: EASE.standard }}
    />
  </td>
</tr>
```

- Fondo: `transition: none` — instantáneo. Feedback en el mismo frame.
- Marcador yema de 2px a la izquierda: `scaleY 0→1` desde arriba, **120ms** entrando,
  **100ms** saliendo (la salida siempre más corta que la entrada).
- La fila **no** se levanta, **no** escala, **no** cambia de sombra. Una fila de tabla no
  es una tarjeta.
- Zebra: la fila impar lleva `background: hsl(var(--bar))`; en hover, `--accent` gana.

### 6.5 Botón — la interacción firma

El botón se hunde en su propia sombra impresa.

```tsx
<motion.button
  className="shadow-[var(--shadow-sm)]"
  whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0 0 hsl(var(--shadow-ink))' }}
  whileTap={{  x:  2, y:  2, boxShadow: '0px 0px 0 0 hsl(var(--shadow-ink))' }}
  transition={{ duration: DUR.quick, ease: EASE.standard }}
/>
```

- **Hover:** se despega 1px arriba-izquierda y la sombra crece a 3px. 120ms.
- **Press:** se desplaza +2px hacia abajo-derecha y la sombra colapsa a 0. **90ms**,
  disparado en `pointerdown` (no en `click`). El botón *entra* en el papel.
- Sin `scale`, sin ripple, sin brillo.
- Estado de carga: el label se reemplaza por `···` en `--font-num` con opacidad
  oscilando 1 → 0.4 → 1, `900ms`, `linear`, en loop. Sin spinner circular.

### 6.6 Cambio de número

Dos comportamientos distintos, no uno.

**a) Primera aparición (conteo):**

```tsx
const mv = useMotionValue(0);
const text = useTransform(mv, (v) =>
  new Intl.NumberFormat('es-MX').format(Math.round(v))
);
useEffect(() => {
  if (reduced) { mv.set(target); return; }
  const c = animate(mv, target, { duration: DUR.count, ease: EASE.standard });
  return c.stop;
}, [target]);
```

- 700ms, `EASE.standard`, solo la primera vez que el KPI entra en viewport.
- `tabular-nums` obligatorio: sin él el ancho tiembla en cada frame.

**b) Actualización posterior (refetch) — no se cuenta, se voltea:**

- Salida: `opacity 1→0`, `y 0→-6`, **110ms**, `EASE.accelerate`.
- Entrada: `y 6→0`, `opacity 0→1`, **160ms**, `EASE.decelerate`.
- Además, destello de marcado: la celda recibe `background: hsl(var(--primary) / 0.35)`
  que se desvanece a 0 en **500ms** `linear`. Es la marca de "esto cambió", equivalente
  al subrayado a mano en la libreta.

### 6.7 Diálogos y toasts

- Scrim: `opacity 0→1`, 160ms. Color `hsl(var(--foreground) / 0.55)`. **Sin blur.**
- Diálogo: `opacity 0→1`, `y -8→0`, **200ms** `EASE.decelerate`. Sin `scale`.
- Salida: **140ms** `EASE.accelerate` (≈70% de la entrada — las salidas siempre más rápidas).
- Toast: entra desde la derecha `x 16→0`, 200ms; sale 140ms. Auto-dismiss a 4s.

### 6.8 `prefers-reduced-motion` — regla del sistema

Una sola fuente de verdad, aplicada en variantes, más un respaldo en CSS.

```tsx
// lib/motion.ts
import { useReducedMotion } from 'framer-motion';

export function useMotionSafe() {
  const reduced = useReducedMotion();
  return {
    reduced,
    // Bajo reduce: se conserva el cross-fade (ayuda a comprender), se elimina el viaje.
    enter: reduced
      ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.12 } } }
      : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0,
          transition: { duration: DUR.enter, ease: EASE.decelerate } } },
    stagger: reduced ? 0 : STAGGER,
    tap:     reduced ? {} : { x: 2, y: 2, boxShadow: '0 0 0 0 hsl(var(--shadow-ink))' }
  };
}
```

Bajo `reduce`:

| Se elimina | Se conserva |
|---|---|
| Todo desplazamiento `x`/`y` | Cross-fades de opacidad |
| `scaleX` de los filetes (aparecen completos) | Cambios de color y estado |
| El stagger (todo entra a la vez) | El destello de "esto cambió" (500ms, sin movimiento) |
| El conteo de KPI (se fija el valor final) | El foco visible |
| El desplazamiento del botón | El colapso de sombra del botón (sin traslación) |

Respaldo global — va al final de `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.12ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-contrast: more) {
  :root, .dark {
    --border: var(--foreground);
    --rule: var(--foreground);
    --muted-foreground: var(--foreground);
    --bw-rule: 2px;
  }
}
```

`prefers-reduced-transparency` no aplica: no hay ninguna superficie translúcida en el
sistema.

---

## 7. Navegación — lo que se conserva

El menú centrado es la única aprobación explícita del usuario. Se conserva y se corrige.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [PA] POLLITO   │ Dashboard│Pedidos│Productos│Clientes│Inv.│WA│Config │  ☰ │
└══════════════════════════════════════════════════════════════════════════┘  ← filete 2px
```

- **Grid de 3 columnas `[1fr auto 1fr]`**, no `justify-between`. Hoy el centrado depende
  de que la marca y las acciones midan lo mismo — cuando el email del usuario es largo,
  el menú se corre. Con grid queda centrado siempre.
- El contenedor del nav **no es una píldora**: sin `rounded-full`, sin fondo de card, sin
  borde exterior. Es una hilera de items separados por filetes verticales de 1px
  (`--rule`), como los rótulos de un directorio.
- Item: `height 32px`, `padding 0 12px`, `--text-2xs` en versalitas con tracking `+0.09em`,
  `--font-display`.
- **Activo:** `background: hsl(var(--primary))` + `color: hsl(var(--primary-foreground))`
  + `border-bottom: 2px solid hsl(var(--foreground))`. Doble señal: color **y** filete.
- **Hover:** `background: hsl(var(--accent))`, instantáneo.
- Header: `height 52px`, `background: hsl(var(--background))` **sólido**,
  `border-bottom: 2px solid hsl(var(--border))`. Sin `backdrop-blur`, sin transparencia.
- El estado de la API deja de ser un `<Badge>` de píldora: pasa a punto de 6px
  (`rounded-dot`, la única excepción de radio) + texto `API OK` / `API CAÍDA` en
  `--font-num` a 10px.

---

## 8. Snippets listos para pegar

### 8.1 `globals.css` — bloque de tokens

```css
@layer base {
  :root {
    --font-ui:      var(--font-ui-next),      ui-sans-serif, system-ui, sans-serif;
    --font-display: var(--font-display-next), var(--font-ui);
    --font-num:     var(--font-num-next),     ui-monospace, monospace;

    /* --- claro: ver §1.1 en su totalidad --- */
    --background: 44 33% 96%;  --foreground: 30 12% 9%;
    --card: 48 33% 99%;        --card-foreground: 30 12% 9%;
    --muted: 42 20% 91%;       --muted-foreground: 32 9% 34%;
    --secondary: 42 20% 91%;   --secondary-foreground: 30 12% 9%;
    --accent: 42 24% 87%;      --accent-foreground: 30 12% 9%;
    --border: 32 12% 55%;      --rule: 34 14% 78%;
    --input: 32 12% 55%;       --ring: 30 12% 9%;
    --bar: 104 22% 86%;
    --primary: 44 96% 52%;     --primary-foreground: 30 12% 9%;
    --success: 146 68% 26%;    --warning: 24 88% 35%;
    --danger: 4 76% 44%;       --info: 212 78% 34%;
    --on-danger: 0 0% 100%;
    --shadow-ink: 30 12% 9%;

    --radius: 0px;
    --bw-ink: 2px;
    --bw-rule: 1px;
    --shadow-sm: 2px 2px 0 0 hsl(var(--shadow-ink));
    --shadow-md: 4px 4px 0 0 hsl(var(--shadow-ink));
    --shadow-lg: 6px 6px 0 0 hsl(var(--shadow-ink));
  }

  .dark {
    --background: 30 8% 8%;    --foreground: 44 28% 92%;
    --card: 30 8% 11%;         --card-foreground: 44 28% 92%;
    --muted: 30 7% 15%;        --muted-foreground: 40 10% 65%;
    --secondary: 30 7% 15%;    --secondary-foreground: 44 28% 92%;
    --accent: 32 8% 19%;       --accent-foreground: 44 28% 92%;
    --border: 36 8% 42%;       --rule: 36 7% 28%;
    --input: 36 8% 42%;        --ring: 44 28% 92%;
    --bar: 140 14% 14%;
    --primary: 44 92% 62%;     --primary-foreground: 30 10% 8%;
    --success: 148 56% 52%;    --warning: 28 90% 60%;
    --danger: 6 84% 64%;       --info: 210 84% 66%;
    --on-danger: 30 10% 8%;
    --shadow-ink: 36 8% 42%;
  }

  * { @apply border-border; border-radius: 0; }
  html { font: 400 14px/1.45 var(--font-ui); }
  body { @apply bg-background text-foreground antialiased; }
}
```

### 8.2 `tailwind.config.ts` — cambios

```ts
theme: {
  borderRadius: {
    none: '0px', sm: '0px', DEFAULT: '0px', md: '0px',
    lg: '0px', xl: '0px', '2xl': '0px', '3xl': '0px',
    full: '0px', dot: '9999px'
  },
  extend: {
    colors: {
      /* ...los existentes... */
      rule: 'hsl(var(--rule))',
      bar:  'hsl(var(--bar))'
    },
    fontFamily: {
      sans:    ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      display: ['var(--font-display)', 'var(--font-ui)', 'sans-serif'],
      num:     ['var(--font-num)', 'ui-monospace', 'monospace']
    },
    fontSize: {
      '2xs':  ['11px', { lineHeight: '14px', letterSpacing: '0.09em',   fontWeight: '600' }],
      xs:     ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
      sm:     ['13px', { lineHeight: '18px', letterSpacing: '0' }],
      base:   ['14px', { lineHeight: '20px', letterSpacing: '0' }],
      md:     ['16px', { lineHeight: '22px', letterSpacing: '-0.005em' }],
      lg:     ['20px', { lineHeight: '24px', letterSpacing: '-0.012em' }],
      xl:     ['26px', { lineHeight: '28px', letterSpacing: '-0.018em' }],
      '2xl':  ['34px', { lineHeight: '34px', letterSpacing: '-0.022em' }],
      '3xl':  ['46px', { lineHeight: '44px', letterSpacing: '-0.028em' }]
    },
    borderWidth: { ink: '2px', rule: '1px' },
    boxShadow: {
      sm:   'var(--shadow-sm)',
      md:   'var(--shadow-md)',
      lg:   'var(--shadow-lg)',
      none: '0 0 0 0 transparent'
    }
  }
}
```

Nota: se elimina `boxShadow.soft` y la extensión de `borderRadius` actual.

---

## 9. Checklist antes de dar por terminada la UI

Visual
- [ ] `grep -r "rounded-\(full\|lg\|xl\|2xl\|3xl\)" frontend/` no devuelve nada
- [ ] `grep -r "backdrop-blur\|shadow-soft\|blur-" frontend/` no devuelve nada
- [ ] Ninguna `box-shadow` del proyecto tiene blur > 0
- [ ] Cero gradientes, cero morado/índigo
- [ ] Un solo set de iconos; `lucide-react` fuera de `package.json`
- [ ] Ninguna card anidada dentro de otra card

Densidad
- [ ] A 1080px de alto se ven ≥18 filas de pedido sin scroll
- [ ] Filas de tabla a 36px, `<thead>` a 32px
- [ ] Todo el espaciado sale de la escala base-4

Tipografía
- [ ] Toda cifra lleva `tabular-nums`; ninguna columna numérica tiembla al actualizar
- [ ] Dinero formateado con `Intl.NumberFormat('es-MX', {currency:'MXN'})`
- [ ] Etiquetas en versalitas usan `--text-2xs` con `+0.09em`, nunca tracking cero

Color y accesibilidad
- [ ] Contraste verificado en claro **y** en oscuro por separado
- [ ] Ningún estado se comunica solo con color
- [ ] Foco visible: recuadro de 2px con 2px de offset, en ambos temas
- [ ] Filetes visibles en ambos temas (`--border` cumple 3:1 en los dos)

Movimiento
- [ ] Ninguna animación excede 500ms salvo el conteo de KPI (700ms)
- [ ] El stagger total nunca pasa de 460ms
- [ ] Cero `spring`, cero overshoot, cero bounce
- [ ] El feedback del botón dispara en `pointerdown`, no en `click`
- [ ] Con `prefers-reduced-motion: reduce` activo: no hay traslación, todo sigue legible
- [ ] Nada re-anima al volver a hacer scroll hacia arriba (`once: true`)

Móvil
- [ ] Bajo 768px las tablas son listas de fichas, no scroll horizontal
- [ ] `<input>` a 16px en móvil (sin auto-zoom de iOS)
- [ ] Destinos táctiles de acción ≥44px de área de golpe
