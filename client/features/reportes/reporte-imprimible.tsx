'use client';

import { formatCurrency, formatKg } from '@/client/lib/formatters';
import type { InventarioResumen, Pedido } from '@/client/types/models';
import { calcular, type Periodo, type RangoManual } from './reportes-data';

/**
 * El reporte en papel.
 *
 * POR QUE CSS DE IMPRESION Y NO UNA LIBRERIA DE PDF
 *
 * Lo que pide un reporte contable es alineacion tabular perfecta (los puntos
 * decimales formando una vertical), lineas divisorias de 1px, y una jerarquia
 * tipografica que se lea de un vistazo. Todo eso lo hace el navegador mejor y
 * con menos codigo que posicionando cajas a mano con jsPDF — que ademas
 * añadiria ~350 kB al paquete para reimplementar peor lo que el motor de
 * renderizado ya hace.
 *
 * El usuario abre esta pantalla y guarda como PDF desde el dialogo de
 * impresion, que es donde ademas elige tamaño y margenes.
 *
 * DOS DOCUMENTOS DISTINTOS, NO UNO CON MAS FILAS
 *
 * El corte de caja responde "¿cuadra la caja con lo que salio de la bodega?" y
 * se lee en un minuto. El transaccional responde "¿que paso exactamente el
 * martes?" y se lee con el dedo. Mezclarlos daria un documento que no sirve
 * para ninguna de las dos cosas.
 */

export type TipoReporte = 'corte' | 'detalle';

export function ReporteImprimible({
  tipo,
  pedidos,
  inventario,
  periodo,
  manual,
  etiquetaPeriodo
}: {
  tipo: TipoReporte;
  pedidos: Pedido[];
  inventario: InventarioResumen[];
  periodo: Periodo;
  manual?: RangoManual;
  etiquetaPeriodo: string;
}) {
  const d = calcular(pedidos, inventario, periodo, manual);
  const vendidos = d.delPeriodo.filter(
    (p) => p.estado === 'confirmado' || p.estado === 'completado'
  );

  return (
    <article className="reporte">
      <Encabezado
        titulo={tipo === 'corte' ? 'Corte de caja' : 'Detalle de pedidos'}
        etiquetaPeriodo={etiquetaPeriodo}
        desde={d.desde}
        hasta={d.hasta}
      />

      {tipo === 'corte' ? (
        <CorteDeCaja d={d} inventario={inventario} />
      ) : (
        <Transaccional pedidos={d.delPeriodo} ingreso={d.ingreso} />
      )}

      <footer className="pie">
        Bascula — {vendidos.length}{' '}
        {vendidos.length === 1 ? 'pedido cobrado' : 'pedidos cobrados'} de {d.totalPeriodo}{' '}
        en el periodo. Generado el {fechaHora(new Date())}.
      </footer>
    </article>
  );
}

function Encabezado({
  titulo,
  etiquetaPeriodo,
  desde,
  hasta
}: {
  titulo: string;
  etiquetaPeriodo: string;
  desde: Date;
  hasta: Date;
}) {
  // El periodo "Todo" arranca en el epoch. Poner "31 de diciembre de 1969" en
  // un documento contable parece un error de datos, no un rango abierto.
  const desdeElPrincipio = desde.getFullYear() < 1980;

  return (
    <header className="cabecera">
      <div>
        <p className="marca">Bascula</p>
        <h1>{titulo}</h1>
      </div>
      <div className="periodo">
        <p className="etiqueta">Periodo</p>
        <p className="valor">{etiquetaPeriodo}</p>
        <p className="rango">
          {desdeElPrincipio
            ? `Hasta el ${soloFecha(new Date(hasta.getTime() - 1))}`
            : `${soloFecha(desde)} — ${soloFecha(new Date(hasta.getTime() - 1))}`}
        </p>
      </div>
    </header>
  );
}

/** El documento de cierre: ¿cuadra la caja con lo que salio de la bodega? */
function CorteDeCaja({
  d,
  inventario
}: {
  d: ReturnType<typeof calcular>;
  inventario: InventarioResumen[];
}) {
  const mermaPorProducto = new Map(
    inventario.map((i) => [i.nombre, Number(i.total_mermas ?? 0)])
  );
  const stockPorProducto = new Map(
    inventario.map((i) => [
      i.nombre,
      { actual: Number(i.stock_actual ?? 0), minimo: Number(i.stock_minimo ?? 0) }
    ])
  );

  const hayCosto = d.coberturaCosto > 0;

  return (
    <>
      <section className="pulso">
        <Cifra etiqueta="Ingreso total" valor={formatCurrency(d.ingreso)} grande />
        <Cifra etiqueta="Kilos desplazados" valor={formatKg(d.kg)} grande />
        {hayCosto ? (
          <Cifra etiqueta="Ganancia" valor={formatCurrency(d.ganancia)} grande />
        ) : null}
        <Cifra etiqueta="Pedidos cobrados" valor={String(d.pedidos)} />
        <Cifra etiqueta="Ticket promedio" valor={formatCurrency(d.ticket)} />
      </section>

      {hayCosto && d.coberturaCosto < 0.99 ? (
        <p className="advertencia">
          La ganancia esta calculada solo sobre el {Math.round(d.coberturaCosto * 100)}% de
          los kilos vendidos, que es la parte con costo capturado. El margen real es menor.
        </p>
      ) : null}

      <h2>Flujo por producto</h2>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th className="num">Kg vendidos</th>
            <th className="num">Ingreso</th>
            {hayCosto ? <th className="num">Ganancia</th> : null}
            <th className="num">Merma</th>
            <th>Bodega</th>
          </tr>
        </thead>
        <tbody>
          {d.productos.map((p) => {
            const merma = mermaPorProducto.get(p.nombre) ?? 0;
            const stock = stockPorProducto.get(p.nombre);
            const bajo = stock ? stock.actual <= stock.minimo : false;
            return (
              <tr key={p.nombre}>
                <td>{p.nombre}</td>
                <td className="num">{formatKg(p.kg)}</td>
                <td className="num">{formatCurrency(p.ingreso)}</td>
                {hayCosto ? (
                  <td className="num">{formatCurrency(p.ingreso - p.costo)}</td>
                ) : null}
                <td className="num">{merma > 0 ? formatKg(merma) : '—'}</td>
                <td className={bajo ? 'alerta' : undefined}>
                  {stock
                    ? bajo
                      ? `Bajo minimo — ${formatKg(stock.actual)}`
                      : `${formatKg(stock.actual)}`
                    : '—'}
                </td>
              </tr>
            );
          })}
          {d.productos.length === 0 ? (
            <tr>
              <td colSpan={hayCosto ? 6 : 5} className="vacio">
                No hubo ventas en este periodo.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="dos-columnas">
        <div>
          <h2>Quien te sostuvo</h2>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="num">Pedidos</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {d.clientes.slice(0, 5).map((c) => (
                <tr key={c.telefono}>
                  <td>
                    {c.nombre}
                    <span className="sub">{c.telefono}</span>
                  </td>
                  <td className="num">{c.pedidos}</td>
                  <td className="num">{formatCurrency(c.ingreso)}</td>
                </tr>
              ))}
              {d.clientes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="vacio">
                    Sin compras en el periodo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          <h2>Lo que no se concreto</h2>
          <table>
            <tbody>
              <tr>
                <td>Pedidos cancelados</td>
                <td className="num">
                  {d.cancelados} de {d.totalPeriodo}
                </td>
              </tr>
              <tr>
                <td>Merma acumulada</td>
                <td className="num">{formatKg(d.merma.kg)}</td>
              </tr>
              <tr>
                <td>Merma valuada a precio de venta</td>
                <td className="num">{formatCurrency(d.merma.dinero)}</td>
              </tr>
            </tbody>
          </table>
          <p className="nota">
            La merma es historica completa, no del periodo: el resumen de inventario no
            guarda fecha por movimiento.
          </p>
        </div>
      </div>
    </>
  );
}

/** El libro mayor: que paso, cuando y con quien. */
function Transaccional({ pedidos, ingreso }: { pedidos: Pedido[]; ingreso: number }) {
  const ordenados = [...pedidos].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <>
      <p className="contexto">
        {ordenados.length} {ordenados.length === 1 ? 'pedido' : 'pedidos'} en el periodo.
        Ingreso acumulado de los cobrados: <b>{formatCurrency(ingreso)}</b>.
      </p>

      <table className="ancha">
        <thead>
          <tr>
            <th>Folio y fecha</th>
            <th>Cliente</th>
            <th>Detalle</th>
            <th className="num">Kg</th>
            <th className="num">Importe</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((p) => {
            const detalles = p.pedido_detalles ?? p.detalles ?? [];
            const cliente = p.clientes ?? p.cliente;
            return (
              <tr key={p.id}>
                <td>
                  {/* El folio en monoespaciada y en negrita: es el ancla con la
                      que el ojo recorre la hoja buscando una venta concreta. */}
                  <span className="folio">#{p.id.slice(0, 8)}</span>
                  <span className="sub">{fechaHora(new Date(p.created_at))}</span>
                </td>
                <td>
                  {cliente?.nombre ?? 'Sin nombre'}
                  <span className="sub">{cliente?.telefono ?? ''}</span>
                </td>
                <td className="detalle">
                  {detalles.length
                    ? detalles
                        .map(
                          (dd) =>
                            `${formatKg(dd.kg)} ${dd.productos?.nombre ?? dd.producto?.nombre ?? ''}`
                        )
                        .join(', ')
                    : '—'}
                </td>
                <td className="num">{formatKg(p.total_kg)}</td>
                <td className="num">{formatCurrency(p.total_precio)}</td>
                <td>{p.estado}</td>
              </tr>
            );
          })}
          {ordenados.length === 0 ? (
            <tr>
              <td colSpan={6} className="vacio">
                No hubo pedidos en este periodo.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

function Cifra({
  etiqueta,
  valor,
  grande
}: {
  etiqueta: string;
  valor: string;
  grande?: boolean;
}) {
  return (
    <div className={grande ? 'cifra grande' : 'cifra'}>
      <p className="etiqueta">{etiqueta}</p>
      <p className="valor">{valor}</p>
    </div>
  );
}

const soloFecha = (d: Date): string =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);

const fechaHora = (d: Date): string =>
  new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
