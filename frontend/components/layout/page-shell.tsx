import { cn } from '@/lib/utils';

/**
 * Estructura comun de todas las paginas:
 *
 *   [ barra de pagina: titulo + acciones ]   <- fija, no scrollea
 *   [ contenido ]                            <- scrollea por dentro
 *
 * `fill` sirve para las pantallas cuyo contenido debe ocupar exactamente el
 * alto disponible (por ejemplo una tabla con su propio scroll) en vez de
 * dejar hueco al final.
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
      <div className="flex h-pagebar shrink-0 items-center justify-between gap-4 border-b border-rule bg-surface px-4 lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-md font-semibold leading-tight">{title}</h1>
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1',
          fill ? 'flex flex-col overflow-hidden p-3 lg:p-4' : 'scroll-y p-3 lg:p-4'
        )}
      >
        {children}
      </div>
    </div>
  );
}
