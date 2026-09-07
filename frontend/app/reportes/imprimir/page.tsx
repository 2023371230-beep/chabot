'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import { PERIODOS, type Periodo } from '@/features/reportes/reportes-data';
import {
  ReporteImprimible,
  type TipoReporte
} from '@/features/reportes/reporte-imprimible';
import './imprimir.css';

/**
 * La hoja lista para guardar como PDF.
 *
 * Es una pantalla aparte y no un modo de Reportes porque el documento tiene su
 * propia maqueta: fondo blanco, escala de grises, cifras tabulares y nada de
 * la barra de navegacion. Meterlo dentro de la pantalla existente obligaria a
 * esconder medio dashboard con reglas de impresion, y lo que se imprimiera
 * seria siempre un poco distinto a lo que se ve.
 *
 * El dialogo de impresion se abre solo, una vez, cuando los datos estan. Abrir
 * la ventana y esperar a que el usuario descubra que tiene que pulsar imprimir
 * es friccion que no aporta nada.
 */
export default function ImprimirReportePage() {
  const params = useSearchParams();
  const tipo = (params.get('tipo') ?? 'corte') as TipoReporte;
  const periodo = (params.get('periodo') ?? 'mes') as Periodo;
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';

  const orders = useApi(() => endpoints.pedidos.list(), [], 'pedidos');
  const inventory = useApi(() => endpoints.inventario.resumen(), [], 'inventario-resumen');
  const [yaImprimio, setYaImprimio] = useState(false);

  const listo = !orders.loading && !inventory.loading && Boolean(orders.data);

  useEffect(() => {
    if (!listo || yaImprimio) return;
    setYaImprimio(true);
    // Un cuadro de margen: el dialogo se abre despues de que el navegador haya
    // pintado la hoja, no antes. Sin esto, en Chrome la vista previa sale en
    // blanco de vez en cuando.
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [listo, yaImprimio]);

  const etiqueta =
    periodo === 'personalizado'
      ? `${desde} a ${hasta}`
      : (PERIODOS.find((p) => p.valor === periodo)?.etiqueta ?? 'Periodo');

  if (!listo) {
    return <p className="cargando">Preparando el reporte...</p>;
  }

  return (
    <>
      {/* Solo se ve en pantalla: al imprimir se oculta. Da salida a quien llego
          aqui y cerro el dialogo sin querer. */}
      <div className="barra-pantalla">
        <button type="button" onClick={() => window.print()}>
          Guardar como PDF
        </button>
        <button type="button" onClick={() => window.close()}>
          Cerrar
        </button>
        <span>
          En el dialogo, elige <b>Destino: Guardar como PDF</b>.
        </span>
      </div>

      <ReporteImprimible
        tipo={tipo}
        pedidos={orders.data ?? []}
        inventario={inventory.data ?? []}
        periodo={periodo}
        manual={desde && hasta ? { desde, hasta } : undefined}
        etiquetaPeriodo={etiqueta}
      />
    </>
  );
}
