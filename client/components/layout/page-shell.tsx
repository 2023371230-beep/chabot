import { cn } from '@/client/lib/utils';

/**
 * Estructura comun de todas las paginas:
 *
 *   [ barra de pagina: titulo + acciones ]   <- fija, no scrollea
 *   [ contenido ]                            <- scrollea por dentro
 *
 * `fill` sirve para las pantallas cuyo contenido debe ocupar exactamente el
 * alto disponible (por ejemplo una tabla con su propio scroll) en vez de
 * dejar hueco al final.
 *
 * OJO CON `fill`: apaga el scroll de la pagina. Solo vale si el hijo maneja
 * el suyo. Una pantalla con `fill` y un hijo sin scroll deja el contenido de
 * abajo INALCANZABLE — no cortado a medias, sino imposible de ver. Le paso a
 * la de WhatsApp: 608 px de contenido, incluido un panel entero, fuera del
 * alcance en una ventana de 900 px de alto.
 */
export function PageShell({
  title,
  description,
  action,
  children,
  fill = false
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* La barra crece si hace falta, en vez de recortar.
          Antes era `h-pagebar` con las acciones en `shrink-0` y sin salto de
          linea: en cuanto una pantalla ponia mas controles de los que caben,
          se salian de la pantalla SIN scroll. En Reportes eso dejaba los ocho
          botones de periodo inalcanzables desde el celular — el titulo mismo
          quedaba aplastado a cero de ancho.
          Ahora en movil el titulo va arriba y las acciones debajo, deslizables
          en horizontal; de `sm` para arriba se comportan como siempre. */}
      <div className="flex min-h-pagebar shrink-0 flex-col justify-center gap-1.5 border-b border-rule bg-surface px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0 lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-md font-semibold leading-tight">{title}</h1>
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? (
          // Los margenes negativos hacen que la fila deslizable llegue hasta el
          // borde: sin ellos, el ultimo boton parece el final de la lista y
          // nadie descubre que hay mas a la derecha.
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:shrink-0 sm:overflow-x-visible sm:px-0 sm:pb-0">
            {action}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1',
          // `fill` es una maqueta de ESCRITORIO: altura fija, sin scroll de
          // pagina, y las tablas scrollean por dentro. En un telefono eso es
          // dañino — el contenedor `overflow-hidden` recorta lo que no cabe y
          // no hay forma de bajar. En el Inicio dejaba la lista de pedidos
          // cortada a media pantalla, sin salida.
          //
          // Por eso el candado de altura entra solo de `lg` para arriba.
          // Debajo, la pagina scrollea sola como cualquier pagina de movil, que
          // es lo que un dedo espera. `overflow-y-auto` de base y
          // `lg:overflow-hidden` encima: la variante responsiva gana en pantalla
          // grande y recupera el comportamiento de escritorio intacto.
          fill
            ? 'overflow-y-auto overscroll-contain p-3 lg:flex lg:flex-col lg:overflow-hidden lg:p-4'
            : 'scroll-y p-3 lg:p-4'
        )}
      >
        {children}
      </div>
    </div>
  );
}
