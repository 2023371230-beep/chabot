/**
 * Set de iconos propio, estilo imprenta.
 *
 * Lo que los saca de lo generico: lucide, heroicons y phosphor redondean
 * todos los remates. Aqui nada se redondea -- `strokeLinecap="square"` y
 * `strokeLinejoin="miter"`. Coordenadas ancladas a .25/.75 para que el trazo
 * de 1.5 caiga nitido a 16px.
 *
 * Se renderizan a 16px o 32px. Nada intermedio.
 * Ningun icono va solo: siempre con texto al lado o con aria-label.
 */
import * as React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="geometricPrecision"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Pizarron de control: marco con tres barras de altura desigual. */
export const IconDashboard = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 2.25h11.5v11.5h-11.5z" />
    <path d="M5 11.25V7.75" />
    <path d="M8 11.25V4.75" />
    <path d="M11 11.25V9.25" />
  </Icon>
);

/** Nota de remision: ticket con el borde inferior dentado. */
export const IconPedidos = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.25 2.25h9.5v9.25l-1.58 1.25-1.59-1.25-1.58 1.25-1.59-1.25-1.58 1.25-1.58-1.25z" />
    <path d="M5.75 5.5h4.5" />
    <path d="M5.75 7.75h3" />
  </Icon>
);

/** Caja de plastico apilable. */
export const IconProductos = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 4.25h11l-1 9.25h-9z" />
    <path d="M2.85 7.75h10.3" />
    <path d="M6.5 5.9h3" />
  </Icon>
);

/** Ficha de cliente. */
export const IconClientes = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 3.25h11.5v9.5h-11.5z" />
    <path d="M5 5.75h2.5v2.5h-2.5z" />
    <path d="M3.9 10.75v-.75h4.7v.75" />
    <path d="M10 6.5h2.5" />
    <path d="M10 9h2" />
  </Icon>
);

/** Anaquel con existencia desigual. */
export const IconInventario = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 2.25h11.5v11.5h-11.5z" />
    <path d="M2.25 6.1h11.5" />
    <path d="M2.25 9.95h11.5" />
    <path d="M4.25 4.35h3.5" />
    <path d="M4.25 8.2h6" />
    <path d="M4.25 12.05h2" />
  </Icon>
);

/** Tres faders. Deliberadamente NO es un engrane. */
export const IconConfiguracion = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 2.5v11" />
    <path d="M8 2.5v11" />
    <path d="M12 2.5v11" />
    <path d="M2.6 5.5h2.8" />
    <path d="M6.6 9.75h2.8" />
    <path d="M10.6 7.25h2.8" />
  </Icon>
);

/** Globo de dialogo cuadrado. */
export const IconWhatsapp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 2.75h11.5v7.75h-7.25l-2.5 2.75v-2.75h-1.75z" />
    <path d="M5.25 5.75h5.5" />
    <path d="M5.25 7.9h3.5" />
  </Icon>
);

/** Sello de mas. */
export const IconAgregar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 2.25h11.5v11.5h-11.5z" />
    <path d="M8 4.75v6.5" />
    <path d="M4.75 8h6.5" />
  </Icon>
);

/** Lupa cuadrada. */
export const IconBuscar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 2.75h7.5v7.5h-7.5z" />
    <path d="M10.25 10.25l3 3" />
  </Icon>
);

/** Puerta y flecha. */
export const IconSalir = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.75 2.75h3.5v10.5h-3.5" />
    <path d="M2.75 8h6" />
    <path d="M6.25 5.25l2.75 2.75-2.75 2.75" />
  </Icon>
);

/** Sol cuadrado. */
export const IconTema = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.75 5.75h4.5v4.5h-4.5z" />
    <path d="M8 1.75v1.75" />
    <path d="M8 12.5v1.75" />
    <path d="M1.75 8h1.75" />
    <path d="M12.5 8h1.75" />
    <path d="M3.4 3.4l1.25 1.25" />
    <path d="M11.35 11.35l1.25 1.25" />
  </Icon>
);

/** Palomita de sello. */
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 8.25l3.25 3.25 7.25-7.25" />
  </Icon>
);

/** Menu de hamburguesa, tres filetes rectos. */
export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 4.25h11.5" />
    <path d="M2.25 8h11.5" />
    <path d="M2.25 11.75h11.5" />
  </Icon>
);

/** Ojo cuadrado: ver detalle. */
export const IconVer = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1.75 8l2.5-3.25h7.5l2.5 3.25-2.5 3.25h-7.5z" />
    <path d="M6.5 6.5h3v3h-3z" />
  </Icon>
);

/** Cruz: cerrar o cancelar. */
export const IconCerrar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.75 3.75l8.5 8.5" />
    <path d="M12.25 3.75l-8.5 8.5" />
  </Icon>
);

/** Triangulo de aviso. */
export const IconAlerta = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.25l6 11.5h-12z" />
    <path d="M8 6.5v3" />
    <path d="M8 11.25v.5" />
  </Icon>
);

/** Reloj de arena: cargando. Se anima con `animate-spin` desde el consumidor. */
export const IconCargando = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.25 2.25h7.5" />
    <path d="M4.25 13.75h7.5" />
    <path d="M4.75 2.25v2.5L8 8l3.25-3.25v-2.5" />
    <path d="M4.75 13.75v-2.5L8 8l3.25 3.25v2.5" />
  </Icon>
);

/** Lapiz recto: editar. */
export const IconEditar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 2.75l2.75 2.75-8 8h-2.75v-2.75z" />
    <path d="M8.75 4.5l2.75 2.75" />
  </Icon>
);

/** Bote cuadrado: borrar. */
export const IconBorrar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.25 4.25h9.5" />
    <path d="M4.25 4.25l.75 9.5h6l.75-9.5" />
    <path d="M6.25 4.25v-2h3.5v2" />
  </Icon>
);

/** Flecha abajo con remate cuadrado. */
export const IconAbajo = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.75 5.75l4.25 4.5 4.25-4.5" />
  </Icon>
);

/** Bascula de mostrador: el simbolo del negocio. */
export const IconBascula = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 13.25h11.5" />
    <path d="M4.25 13.25l1.5-7h4.5l1.5 7" />
    <path d="M5.25 8.75h5.5" />
    <path d="M8 6.25v-2.5" />
  </Icon>
);

/** Auricular cuadrado: telefono. */
export const IconTelefono = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.25 2.75h3l1 3-1.5 1.5 3 3 1.5-1.5 3 1v3h-3c-3.5 0-7-3.5-7-7z" />
  </Icon>
);

/** Hoja de calendario. */
export const IconCalendario = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 3.75h11.5v10h-11.5z" />
    <path d="M2.25 6.75h11.5" />
    <path d="M5.25 2.25v2.5" />
    <path d="M10.75 2.25v2.5" />
  </Icon>
);

/** Bandeja vacia: sin datos. */
export const IconBandeja = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 8.75h3l1 2h3.5l1-2h3" />
    <path d="M2.25 8.75l1.75-6h8l1.75 6v4.5h-11.5z" />
  </Icon>
);

/** Candado cuadrado. */
export const IconCandado = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.25 7.25h9.5v6.5h-9.5z" />
    <path d="M5.5 7.25v-2.5a2.5 2.5 0 015 0v2.5" />
  </Icon>
);

/** Circulo tachado: cancelado / no disponible. */
export const IconProhibido = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 2.75h10.5v10.5h-10.5z" />
    <path d="M3.75 3.75l8.5 8.5" />
  </Icon>
);

/** Interruptor de corriente: activar / desactivar. */
export const IconEncendido = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.25v5.5" />
    <path d="M4.5 4.5a4.75 4.75 0 107 0" />
  </Icon>
);

/** Sobre / enviar. */
export const IconEnviar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 3.25h11.5v9.5h-11.5z" />
    <path d="M2.25 3.25l5.75 5 5.75-5" />
  </Icon>
);

/** Caja con mas: registrar entrada de inventario. */
export const IconCajaMas = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 4.25h11l-1 9.25h-9z" />
    <path d="M8 6.75v4.25" />
    <path d="M5.875 8.875h4.25" />
  </Icon>
);

/** Grafica de barras con eje: reportes. */
export const IconReportes = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 2.25v11.5h11.5" />
    <path d="M5 11.25V8.25" />
    <path d="M8 11.25V4.75" />
    <path d="M11.25 11.25V6.5" />
  </Icon>
);

/** Galon hacia abajo. Gira 180 para indicar "abierto". */
export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.25 6.25 8 10l3.75-3.75" />
  </Icon>
);
