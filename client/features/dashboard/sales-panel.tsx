'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { IconAlerta } from '@/client/components/icons';
import { AnimatedNumber } from '@/client/components/motion';
import { Card, CardHeader, CardTitle } from '@/client/components/ui/card';
import { estadoDelCosto, hayGanancia, resumenGanancia } from '@/client/lib/costos';
import { formatCurrency } from '@/client/lib/formatters';
import type { Pedido } from '@/client/types/models';

/**
 * Panel de ventas.
 *
 * Muestra ingresos SIEMPRE y ganancia SOLO cuando se puede calcular de
 * verdad. La diferencia no es un detalle contable: un dueño que lee "ganancia"
 * sobre un numero que en realidad son ingresos toma decisiones de precio con
 * un margen inventado.
 *
 * La ganancia sale del costo congelado en cada renglon al vender, nunca del
 * costo de hoy. Por eso las ventas anteriores a la captura no llevan ganancia
 * y no la van a llevar nunca — y por eso el aviso distingue ese caso en vez
 * de pedir otra vez algo que el dueño ya hizo.
 *
 * Solo cuentan los pedidos confirmados o entregados: un pedido pendiente
 * todavia no es dinero.
 */
type Fila = { nombre: string; ingreso: number; kg: number };

export function SalesPanel({
  orders,
  productos = []
}: {
  orders: Pedido[];
  /** El catalogo, solo para saber si el dueño ya capturo sus costos. */
  productos?: ReadonlyArray<{ costo_kg?: number | string | null }>;
}) {
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

    // La ganancia del mes sale del MISMO calculo que Reportes: si aqui se
    // sumara distinto, las dos pantallas volverian a contradecirse sobre las
    // mismas ventas, que es justo el error que `resumenGanancia` vino a cerrar.
    const g = resumenGanancia(delMes.flatMap((p) => p.pedido_detalles ?? []));

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
      maxIngreso: top[0]?.ingreso ?? 0,
      ganancia: g.ganancia,
      margen: g.margen,
      cobertura: g.cobertura
    };
  }, [orders]);

  const estado = estadoDelCosto(datos.cobertura, productos);

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

            {/* La ganancia va PEGADA al ingreso, no en la cuadricula de abajo:
                la pregunta del dueño no es "¿cuanto gane?" a secas, es
                "de esto, ¿cuanto me quedo?". Los dos numeros solo contestan
                eso si se leen juntos, uno debajo del otro. Y solo aparece
                cuando es de verdad: una linea de mas es mejor que una cifra
                inventada. */}
            {hayGanancia(estado) ? (
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className="label">Ganancia</span>
                <span className="num text-sm font-semibold">
                  {formatCurrency(datos.ganancia)}
                </span>
                <span className="num text-2xs text-muted-foreground">
                  {Math.round(datos.margen * 100)}%
                </span>
              </p>
            ) : null}
          </div>

          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 border-t border-rule pt-2.5">
            <div>
              <dt className="label">Acumulado</dt>
              <dd className="num mt-0.5 text-sm font-medium">
                {formatCurrency(datos.ingresoTotal)}
              </dd>
            </div>
            <div>
              <dt className="label">Ticket prom.</dt>
              <dd className="num mt-0.5 text-sm font-medium">{formatCurrency(datos.ticket)}</dd>
            </div>
            <div>
              <dt className="label">Kg vendidos</dt>
              <dd className="num mt-0.5 text-sm font-medium">
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

          {/* Cuando los costos estan completos NO se dice nada: la cifra de
              ganancia de arriba ya lo cuenta todo, y un aviso permanente que
              no pide nada se vuelve ruido que se deja de leer — justo el que
              habria que leer el dia que si diga algo. */}
          {estado.tipo === 'completo' ? null : (
            <p className="mt-3 flex items-start gap-1.5 border-t border-rule pt-2.5 text-2xs text-muted-foreground">
              <IconAlerta className="mt-px shrink-0" />
              <span>
                {estado.tipo === 'sin_capturar' ? (
                  <>
                    Esto es lo que <strong className="font-semibold">cobraste</strong>, no tu
                    ganancia. Guarda cuanto te cuesta cada kilo en{' '}
                    <Link href="/productos" className="font-medium text-primary hover:underline">
                      Productos
                    </Link>{' '}
                    y aqui aparece.
                  </>
                ) : estado.tipo === 'ventas_anteriores' ? (
                  <>
                    Tus costos ya estan guardados. Estas ventas son de{' '}
                    <strong className="font-semibold">antes</strong> de capturarlos, asi que no
                    llevan ganancia: el costo se guarda con cada venta. Las nuevas si la van a
                    mostrar.
                  </>
                ) : (
                  <>
                    Sale del{' '}
                    <strong className="font-semibold">
                      {Math.round(estado.cobertura * 100)}%
                    </strong>{' '}
                    de los kilos, que es la parte con costo guardado.{' '}
                    {estado.faltanProductos ? (
                      <>
                        Al resto le falta el costo en{' '}
                        <Link
                          href="/productos"
                          className="font-medium text-primary hover:underline"
                        >
                          Productos
                        </Link>
                        .
                      </>
                    ) : (
                      <>El resto son ventas anteriores a la captura.</>
                    )}
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
