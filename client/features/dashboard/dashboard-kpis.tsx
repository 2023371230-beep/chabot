'use client';

import type { ComponentType, SVGProps } from 'react';
import {
  IconAlerta,
  IconBascula,
  IconCheck,
  IconPedidos,
  IconProductos
} from '@/client/components/icons';
import { AnimatedNumber } from '@/client/components/motion';
import { cn } from '@/client/lib/utils';
import type { InventarioResumen, Pedido, Producto } from '@/client/types/models';

type Tono = 'neutro' | 'accion' | 'ok' | 'alerta';

/**
 * Tira de indicadores. Una sola fila, alto fijo: ocupa el minimo vertical
 * posible para dejarle la pantalla a la tabla, que es lo que de verdad se
 * consulta todo el dia.
 *
 * El orden es por urgencia de lectura, no alfabetico: primero lo que exige una
 * accion hoy, al final lo que solo informa.
 */
function Kpi({
  etiqueta,
  valor,
  sufijo,
  nota,
  icono: Icono,
  tono = 'neutro'
}: {
  etiqueta: string;
  valor: number | string;
  sufijo?: string;
  nota?: string;
  icono: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  tono?: Tono;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 shadow-sm">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
          tono === 'neutro' && 'bg-muted text-muted-foreground',
          tono === 'accion' && 'bg-warning-soft text-warning',
          tono === 'ok' && 'bg-success-soft text-success',
          tono === 'alerta' && 'bg-danger-soft text-danger'
        )}
      >
        <Icono />
      </span>
      <div className="min-w-0">
        {/* En movil la etiqueta ENVUELVE en vez de cortarse: en dos columnas
            angostas "Kilos comprometidos" quedaba en "KILOS COMP...", y en la
            pantalla de vistazo la etiqueta es justo lo que dice que significa
            el numero. De `md` para arriba, donde ya hay ancho, se recorta como
            antes para que las cuatro fichas queden a la misma altura. */}
        <div className="label md:truncate">{etiqueta}</div>
        <div className="num mt-1 text-lg font-semibold leading-none">
          {typeof valor === 'number' ? (
            <AnimatedNumber value={valor} suffix={sufijo} />
          ) : (
            valor
          )}
        </div>
        {nota ? (
          <div className="mt-1 truncate text-2xs text-muted-foreground">{nota}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardKpis({
  orders,
  products,
  inventory
}: {
  orders: Pedido[];
  products: Producto[];
  inventory: InventarioResumen[];
}) {
  const pendientes = orders.filter((o) => o.estado === 'pendiente');
  const confirmados = orders.filter((o) => o.estado === 'confirmado');
  const kgComprometidos = [...pendientes, ...confirmados].reduce(
    (s, o) => s + Number(o.total_kg),
    0
  );
  const bajos = inventory.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo));

  /**
   * El aviso nombra los productos, no solo cuenta cuantos.
   *
   * "Stock bajo: 1" obliga a ir a Productos y revisar nueve filas para saber
   * cual. Y en el celular era peor: el panel que lo explicaba estaba detras de
   * `xl:flex`, asi que el telefono avisaba del problema y nunca decia cual era.
   * Con mas de tres se vuelve a contar, porque una lista larga en una nota de
   * dos lineas no se lee.
   */
  const nombresBajos = bajos.map((i) => i.nombre);
  const notaStock = !bajos.length
    ? 'Todo sobre el minimo'
    : nombresBajos.length <= 3
      ? nombresBajos.join(', ')
      : `${nombresBajos.slice(0, 2).join(', ')} y ${nombresBajos.length - 2} mas`;

  return (
    // Cuatro y no cinco: se quito "Productos activos", que decia "9 de 9" y
    // ocupaba un quinto de la tira para informar de que no pasa nada.
    <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4">
      <Kpi
        etiqueta="Por confirmar"
        valor={pendientes.length}
        nota="No han tocado el stock"
        icono={IconPedidos}
        tono={pendientes.length ? 'accion' : 'neutro'}
      />
      <Kpi
        etiqueta="Stock bajo"
        valor={bajos.length}
        nota={notaStock}
        icono={IconAlerta}
        tono={bajos.length ? 'alerta' : 'ok'}
      />
      <Kpi
        etiqueta="Kilos comprometidos"
        valor={kgComprometidos}
        sufijo=" kg"
        nota="Pedidos sin entregar"
        icono={IconBascula}
      />
      <Kpi
        etiqueta="Confirmados"
        valor={confirmados.length}
        nota="Stock ya descontado"
        icono={IconCheck}
        tono="ok"
      />
    </div>
  );
}
