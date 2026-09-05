import Link from 'next/link';
import { IconAlerta, IconCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKg } from '@/lib/formatters';
import type { InventarioResumen } from '@/types/models';

export function InventoryAlerts({ rows }: { rows: InventarioResumen[] }) {
  const bajos = rows.filter((r) => Number(r.stock_actual) <= Number(r.stock_minimo));

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {bajos.length ? (
            <IconAlerta className="text-danger" />
          ) : (
            <IconCheck className="text-success" />
          )}
          Inventario
        </CardTitle>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/inventario">Ver inventario</Link>
        </Button>
      </CardHeader>

      {bajos.length ? (
        <ul className="scroll-y min-h-0 flex-1 divide-y divide-rule">
          {bajos.map((item) => {
            const actual = Number(item.stock_actual);
            const minimo = Number(item.stock_minimo);
            // Barra relativa al minimo: muestra que tan lejos esta de cubrirlo.
            const pct = minimo > 0 ? Math.min(100, (actual / minimo) * 100) : 0;
            return (
              <li key={item.producto_id} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.nombre}</span>
                  <span className="num shrink-0 text-xs text-danger">
                    {formatKg(actual)}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  Minimo {formatKg(minimo)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Todos los productos estan sobre su minimo.
          </p>
        </div>
      )}
    </Card>
  );
}
