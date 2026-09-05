/**
 * Encabezado simple para paginas anidadas (por ejemplo el detalle de un
 * pedido) que no usan PageShell. Las pantallas principales usan PageShell.
 */
export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-md font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
