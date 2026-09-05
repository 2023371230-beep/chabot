'use client';

import { useMemo } from 'react';
import { IconAlerta } from '@/components/icons';
import { AnimatedNumber } from '@/components/motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import type { Pedido } from '@/types/models';

/**
 * Panel de ventas.
 *
 * IMPORTANTE: esto son INGRESOS (lo facturado), no ganancia. La ganancia es
 * venta menos costo, y hoy la tabla `productos` no guarda un costo por kilo,
 * asi que no se puede calcular sin inventar el dato. En cuanto exista
 * `costo_kg`, este mismo panel muestra margen real.
 *
 * Solo cuentan los pedidos confirmados o entregados: un pedido pendiente
 * todavia no es dinero.
 */
type Fila = { nombre: string; ingreso: number; kg: number };

export function SalesPanel({ orders }: { orders: Pedido[] }) {
  const datos = useMemo(() => {
    const vendidos = orders.filter(
      (o) => o.estado === 'confirmado' || o.estado === 'completado'
    );

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const delMes = vendidos.filter((o) => new Date(o.created_at) >= inicioMes);

    const suma = (lista: Pedido[], campo: 'total_precio' | 'total_kg') =>
      lista.reduce((acc, o) => acc + Number(o[campo] ?? 0), 0);

    const porProducto = new Map<string, Fila>();
    for (const pedido of vendidos) {
      for (const d of pedido.pedido_detalles ?? []) {
        const nombre = d.productos?.nombre ?? 'Sin nombre';
        const actual = porProducto.get(nombre) ?? { nombre, ingreso: 0, kg: 0 };
        actual.ingreso += Number(d.subtotal ?? 0);
        actual.kg += Number(d.kg ?? 0);
        porProducto.set(nombre, actual);
      }
    }

    const top = Array.from(porProducto.values())
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, 5);

    return {
      ingresoMes: suma(delMes, 'total_precio'),
      ingresoTotal: suma(vendidos, 'total_precio'),
      kgVendidos: suma(vendidos, 'total_kg'),
      pedidos: vendidos.length,
      ticket: vendidos.length ? suma(vendidos, 'total_precio') / vendidos.length : 0,
      top,
      maxIngreso: top[0]?.ingreso ?? 0
    };
  }, [orders]);

  return (
    <Card className="shrink-0">
      <CardHeader>
        <CardTitle>Ventas</CardTitle>
        <span className="text-2xs text-muted-foreground">Confirmados y entregados</span>
      </CardHeader>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-3">
          <div>
            <span className="label">Ingresos de este mes</span>
            <div className="num mt-1 text-2xl font-semibold leading-none text-success">
              {formatCurrency(datos.ingresoMes)}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 border-t border-rule pt-2.5">
            <div>
              <dt className="label">Acumulado</dt>
              <dd className="num mt-0.5 text-[13px] font-medium">
                {formatCurrency(datos.ingresoTotal)}
              </dd>
            </div>
            <div>
              <dt className="label">Ticket prom.</dt>
              <dd className="num mt-0.5 text-[13px] font-medium">{formatCurrency(datos.ticket)}</dd>
            </div>
            <div>
              <dt className="label">Kg vendidos</dt>
              <dd className="num mt-0.5 text-[13px] font-medium">
                <AnimatedNumber value={datos.kgVendidos} suffix=" kg" />
              </dd>
            </div>
          </dl>
        </div>

        {/* Barras por producto: con 5 filas se lee mejor que una grafica. */}
        <div className="flex flex-col border-t border-rule pt-2.5">
          <span className="label">Lo que mas deja</span>
          {datos.top.length ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {datos.top.map((fila) => (
                <li key={fila.nombre} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs">{fila.nombre}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                      style={{
                        width: datos.maxIngreso
                          ? `${Math.max(4, (fila.ingreso / datos.maxIngreso) * 100)}%`
                          : '0%'
                      }}
                    />
                  </span>
                  <span className="num w-[70px] shrink-0 text-right text-xs">
                    {formatCurrency(fila.ingreso)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Todavia no hay pedidos confirmados. En cuanto confirmes uno, aqui aparece
              cuanto dejo cada producto.
            </p>
          )}

          {/* El dato honesto: esto no es ganancia. */}
          <p className="mt-3 flex items-start gap-1.5 border-t border-rule pt-2.5 text-2xs text-muted-foreground">
            <IconAlerta className="mt-px shrink-0" />
            <span>
              Esto es lo que <strong className="font-semibold">cobraste</strong>, no tu
              ganancia. Para calcular ganancia falta guardar cuanto te cuesta cada kilo.
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
