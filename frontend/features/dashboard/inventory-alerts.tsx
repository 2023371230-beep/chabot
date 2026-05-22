import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatKg } from '@/lib/formatters';
import type { InventarioResumen } from '@/types/models';

export function InventoryAlerts({ rows }: { rows: InventarioResumen[] }) {
  const lowStock = rows.filter(
    (row) => Number(row.stock_actual) <= Number(row.stock_minimo)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-warning" />
          Alertas de inventario
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lowStock.length ? (
          <div className="space-y-3">
            {lowStock.slice(0, 5).map((item) => (
              <div
                key={item.producto_id}
                className="flex items-center justify-between rounded-2xl bg-warning/10 p-3"
              >
                <div>
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    Actual {formatKg(item.stock_actual)} · minimo{' '}
                    {formatKg(item.stock_minimo)}
                  </p>
                </div>
                <Badge variant="warning">bajo</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todo el inventario esta sobre minimo.
          </p>
        )}
        <Button className="mt-4 w-full" variant="outline" asChild>
          <Link href="/inventario">Ver inventario</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
