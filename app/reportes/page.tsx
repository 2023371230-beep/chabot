'use client';

import { useMemo, useState } from 'react';
import { IconAlerta, IconBascula, IconClientes, IconPedidos, IconReportes } from '@/client/components/icons';
import { PageShell } from '@/client/components/layout/page-shell';
import { ErrorState } from '@/client/components/shared/error-state';
import { LoadingSkeleton } from '@/client/components/shared/loading-skeleton';
import { Card, CardHeader, CardTitle } from '@/client/components/ui/card';
import { cn } from '@/client/lib/utils';
import { endpoints } from '@/client/lib/api/endpoints';
import Link from 'next/link';
import { useApi } from '@/client/hooks/use-api';
import { estadoDelCosto } from '@/client/lib/costos';
import { formatCurrency, formatKg } from '@/client/lib/formatters';
import {
  PERIODOS,
  calcular,
  type Periodo,
  type RangoManual
} from '@/client/features/reportes/reportes-data';
import { VentasDetalle } from '@/client/features/reportes/ventas-detalle';

/** Indicador con comparacion contra el periodo anterior del mismo largo. */
function Indicador({
  etiqueta,
  valor,
  variacion,
  hayPrevio,
  ayuda,
  icono: Icono
}: {
  etiqueta: string;
  valor: string;
  variacion: number | null;
  hayPrevio: boolean;
  ayuda: string;
  icono: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
}) {
  const sube = (variacion ?? 0) > 0;
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{etiqueta}</span>
        <Icono className="shrink-0 text-muted-foreground/60" />
      </div>
      <div className="num mt-1.5 text-xl font-semibold leading-none">{valor}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {hayPrevio && variacion !== null ? (
          <span
            className={cn(
              'num rounded-full px-1.5 py-0.5 text-2xs font-semibold',
              sube ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
            )}
          >
            {sube ? '+' : ''}
            {variacion.toFixed(0)}%
          </span>
        ) : null}
        <span className="text-2xs text-muted-foreground">
          {hayPrevio && variacion !== null ? 'vs. periodo anterior' : 'Sin periodo previo'}
        </span>
      </div>
      <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
        {ayuda}
      </p>
    </Card>
  );
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  /**
   * El rango que el usuario elige a mano.
   *
   * Arranca en el dia de hoy para las dos fechas: un rango vacio no calcularia
   * nada y la pantalla se veria rota al elegir "Elegir fechas".
   */
  const [manual, setManual] = useState<RangoManual>(() => {
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate()
    ).padStart(2, '0')}`;
    return { desde: iso, hasta: iso };
  });
  const [vista, setVista] = useState<'resumen' | 'detalle'>('resumen');
  const orders = useApi(() => endpoints.pedidos.list(), [], 'pedidos');
  const inventory = useApi(() => endpoints.inventario.resumen(), [], 'inventario-resumen');
  // Solo para distinguir "no has capturado costos" de "ya los capturaste,
  // pero estas ventas son de antes". Comparte cache con Productos.
  const productos = useApi(() => endpoints.productos.list(), [], 'productos');

  const loading = orders.loading || inventory.loading;
  const error = orders.error ?? inventory.error;

  const d = useMemo(
    () => calcular(orders.data ?? [], inventory.data ?? [], periodo, manual),
    [orders.data, inventory.data, periodo, manual]
  );

  // Salen del mismo calculo, no de una segunda pasada sobre el historico.
  const pedidosDelPeriodo = d.delPeriodo;

  const estadoCosto = estadoDelCosto(d.coberturaCosto, productos.data ?? []);

  const maxIngreso = d.productos[0]?.ingreso ?? 0;
  const tasaCancelacion = d.totalPeriodo ? (d.cancelados / d.totalPeriodo) * 100 : 0;

  return (
    <PageShell
      fill
      title="Reportes"
      description="Cuanto vendiste, que se vende mas y quien te compra."
      action={
        <>
          {/* El PDF sale del periodo que se este viendo: pedirlo otra vez en un
              dialogo aparte seria repetir una decision que el usuario acaba de
              tomar. Se abre en otra pestaña para no perder lo que hay en
              pantalla. */}
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams({ tipo: vista === 'detalle' ? 'detalle' : 'corte', periodo });
              if (periodo === 'personalizado') {
                q.set('desde', manual.desde);
                q.set('hasta', manual.hasta);
              }
              window.open(`/reportes/imprimir?${q}`, '_blank', 'noopener');
            }}
            className="flex h-9 items-center gap-1.5 rounded-sm border border-input bg-surface px-3 text-xs font-medium transition-colors hover:bg-accent"
            title={
              vista === 'detalle'
                ? 'Libro de pedidos: folio, fecha, cliente y detalle'
                : 'Corte de caja: ingreso, kilos, productos y mermas'
            }
          >
            <IconReportes />
            PDF
          </button>

          <div role="group" aria-label="Vista del reporte" className="flex rounded-md bg-muted p-0.5">
            {([
              ['resumen', 'Resumen'],
              ['detalle', 'Ventas detalladas']
            ] as const).map(([v, etiqueta]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  vista === v
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        {/* En el celular, un desplegable. En pantalla grande, los botones.
            Ocho botones cortos en una fila son un control segmentado legitimo
            y rapido cuando caben; cuando no caben se apilan en una columna de
            312 px pegada al borde, y eso ya no es un control, es un estorbo.
            El desplegable nativo ademas abre el selector del sistema, que se
            maneja con el pulgar. */}
        <label className="sm:hidden">
          <span className="sr-only">Periodo del reporte</span>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="h-9 rounded-md border border-input bg-surface px-2 text-xs font-medium"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <div
          role="group"
          aria-label="Periodo del reporte"
          className="hidden rounded-md bg-muted p-0.5 sm:flex sm:flex-wrap"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              title={p.explica}
              aria-pressed={periodo === p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                periodo === p.valor
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {/* Las fechas solo aparecen cuando hacen falta. Dos campos siempre
            visibles competirian con los botones rapidos, que es lo que se usa
            casi siempre. */}
        {periodo === 'personalizado' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={manual.desde}
              max={manual.hasta}
              onChange={(e) => setManual((r) => ({ ...r, desde: e.target.value }))}
              aria-label="Desde"
              className="h-9 rounded-sm border border-input bg-surface px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <input
              type="date"
              value={manual.hasta}
              min={manual.desde}
              onChange={(e) => setManual((r) => ({ ...r, hasta: e.target.value }))}
              aria-label="Hasta"
              className="h-9 rounded-sm border border-input bg-surface px-2 text-xs"
            />
          </div>
        ) : null}
        </>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState
          title="No se pudieron cargar los reportes"
          description={error}
          onRetry={async () => {
            await Promise.all([orders.refetch(), inventory.refetch()]);
          }}
        />
      ) : vista === 'detalle' ? (
        <Card className="min-h-0 flex-1">
          <VentasDetalle pedidos={pedidosDelPeriodo} />
        </Card>
      ) : (
        <div className="scroll-y flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              etiqueta="Ingresos"
              valor={formatCurrency(d.ingreso)}
              variacion={d.varIngreso}
              hayPrevio={d.hayPrevio}
              ayuda="Lo que cobraste en pedidos confirmados y entregados."
              icono={IconBascula}
            />
            {d.coberturaCosto > 0 ? (
              <Indicador
                etiqueta="Ganancia"
                valor={formatCurrency(d.ganancia)}
                variacion={null}
                hayPrevio={false}
                ayuda={`Ingresos menos costo. Margen ${d.margen.toFixed(1)}%${
                  d.coberturaCosto < 0.99
                    ? ` — con costo capturado en el ${Math.round(d.coberturaCosto * 100)}% de los kilos`
                    : ''
                }.`}
                icono={IconBascula}
              />
            ) : null}
            <Indicador
              etiqueta="Kilos vendidos"
              valor={formatKg(d.kg)}
              variacion={d.varKg}
              hayPrevio={d.hayPrevio}
              ayuda="Peso total que salio del almacen en ese periodo."
              icono={IconBascula}
            />
            <Indicador
              etiqueta="Pedidos"
              valor={String(d.pedidos)}
              variacion={d.varPedidos}
              hayPrevio={d.hayPrevio}
              ayuda="Cuantos pedidos llegaron a confirmarse."
              icono={IconPedidos}
            />
            <Indicador
              etiqueta="Ticket promedio"
              valor={formatCurrency(d.ticket)}
              variacion={null}
              hayPrevio={false}
              ayuda="Cuanto deja un pedido en promedio. Sirve para saber si conviene empujar pedidos mas grandes."
              icono={IconClientes}
            />
          </div>

          <div className="grid min-h-[220px] flex-1 gap-3 xl:grid-cols-2">
            <Card className="min-h-0">
              <CardHeader>
                <CardTitle>Que se vende mas</CardTitle>
                <span className="text-2xs text-muted-foreground">Por ingreso</span>
              </CardHeader>
              {d.productos.length ? (
                <ul className="scroll-y flex min-h-0 flex-1 flex-col divide-y divide-rule">
                  {d.productos.slice(0, 8).map((f) => (
                    <li key={f.nombre} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-24 shrink-0 truncate text-sm font-medium">
                        {f.nombre}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: maxIngreso
                              ? `${Math.max(3, (f.ingreso / maxIngreso) * 100)}%`
                              : '0%'
                          }}
                        />
                      </span>
                      <span className="num w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {formatKg(f.kg)}
                      </span>
                      <span className="num w-24 shrink-0 text-right text-sm font-medium">
                        {formatCurrency(f.ingreso)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay ventas en este periodo.
                </p>
              )}
            </Card>

            <Card className="min-h-0">
              <CardHeader>
                <CardTitle>Quien te compra mas</CardTitle>
                <span className="text-2xs text-muted-foreground">Por ingreso</span>
              </CardHeader>
              {d.clientes.length ? (
                <ul className="scroll-y flex min-h-0 flex-1 flex-col divide-y divide-rule">
                  {d.clientes.slice(0, 8).map((c) => (
                    <li
                      key={c.telefono}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.nombre}</div>
                        <div className="num truncate text-2xs text-muted-foreground">
                          {c.telefono}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-sm font-medium">
                          {formatCurrency(c.ingreso)}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay clientes con compras en este periodo.
                </p>
              )}
            </Card>
          </div>

          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="label">Pedidos cancelados</span>
                <IconPedidos className="text-muted-foreground/60" />
              </div>
              <div className="num mt-1.5 text-xl font-semibold leading-none">
                {d.cancelados}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  de {d.totalPeriodo}
                </span>
              </div>
              <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
                {tasaCancelacion > 20
                  ? `${tasaCancelacion.toFixed(0)}% de los pedidos se cancelan. Vale la pena revisar por que.`
                  : 'Proporcion de pedidos que no llegaron a entregarse.'}
              </p>
            </Card>

            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="label">Merma acumulada</span>
                <IconAlerta className="text-danger/70" />
              </div>
              <div className="num mt-1.5 text-xl font-semibold leading-none text-danger">
                {formatCurrency(d.merma.dinero)}
              </div>
              <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
                {formatKg(d.merma.kg)} registrados como merma, valuados a precio de venta.
                Este dato es historico completo, no del periodo seleccionado.
              </p>
            </Card>
          </div>

{/* El aviso cambia segun cuantos costos haya capturados. Decir siempre
              "esto no es ganancia" cuando ya se capturaron todos seria mentir al
              reves; decir "ganancia" con la mitad de los costos seria peor. */}
          {estadoCosto.tipo === 'completo' ? null : (
            <p className="flex items-start gap-2 rounded-md border border-border bg-surface-2/60 p-3 text-2xs leading-snug text-muted-foreground">
              <IconAlerta className="mt-px shrink-0" />
              <span>
                {estadoCosto.tipo === 'sin_capturar' ? (
                  <>
                    Todo esto son <strong className="font-semibold">ingresos</strong>, no
                    ganancia. Captura el costo por kilo de cada producto en{' '}
                    <Link href="/productos" className="font-medium text-primary hover:underline">
                      Productos
                    </Link>{' '}
                    y estos mismos reportes muestran el margen.
                  </>
                ) : estadoCosto.tipo === 'ventas_anteriores' ? (
                  <>
                    Tus costos ya estan guardados, pero las ventas de este periodo son{' '}
                    <strong className="font-semibold">anteriores</strong> a esa captura. El
                    costo se guarda con cada venta, asi que estas no lo llevan y no lo van a
                    llevar: el margen aparece en cuanto vendas con los costos ya puestos.
                  </>
                ) : (
                  <>
                    La ganancia sale del{' '}
                    <strong className="font-semibold">
                      {Math.round(estadoCosto.cobertura * 100)}%
                    </strong>{' '}
                    de los kilos vendidos, que es la parte con costo guardado.{' '}
                    {estadoCosto.faltanProductos ? (
                      <>
                        El resto son productos a los que les falta el costo: complétalos en{' '}
                        <Link
                          href="/productos"
                          className="font-medium text-primary hover:underline"
                        >
                          Productos
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        El resto son ventas anteriores a que capturaras los costos, y esas ya
                        no lo van a llevar.
                      </>
                    )}
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
