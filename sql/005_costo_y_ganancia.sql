-- ============================================================================
-- 005 — Costo por kilo, para poder hablar de ganancia
-- ============================================================================
--
-- QUÉ RESUELVE
--
-- Reportes solo puede decir INGRESOS. Lo dice honestamente en pantalla ("todo
-- esto son ingresos, no ganancia") porque no hay forma de saber qué costó el
-- pollo que se vendió: el sistema conoce el precio de venta y nada más.
--
-- POR QUÉ EL COSTO SE COPIA AL PEDIDO
--
-- Es la misma razón por la que `pedido_detalles` ya guarda `precio_kg` en vez
-- de leerlo del producto: los precios cambian. Si la ganancia se calculara
-- contra el costo ACTUAL, subir el costo del pollo hoy reescribiría la
-- ganancia de todos los pedidos del año pasado. Un reporte de marzo tiene que
-- seguir diciendo lo mismo en diciembre.
--
-- ES OPCIONAL
--
-- `costo_kg` arranca en 0 y el sistema funciona igual sin tocarlo. Con 0, la
-- ganancia sale igual al ingreso, y la pantalla lo dice en vez de presentar un
-- margen del 100% como si fuera real.
--
-- Se puede correr las veces que haga falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Lo que cuesta cada corte
-- ----------------------------------------------------------------------------

alter table public.productos
  add column if not exists costo_kg numeric(10, 2) not null default 0
    check (costo_kg >= 0);

comment on column public.productos.costo_kg is
  'Lo que cuesta el kilo al negocio. 0 = sin capturar; entonces los reportes no calculan ganancia.';

-- ----------------------------------------------------------------------------
-- El costo con el que se vendió, congelado en el renglón
-- ----------------------------------------------------------------------------

alter table public.pedido_detalles
  add column if not exists costo_kg numeric(10, 2) not null default 0
    check (costo_kg >= 0);

comment on column public.pedido_detalles.costo_kg is
  'Costo del kilo EN EL MOMENTO de la venta. Congelado, igual que precio_kg: cambiar el costo hoy no debe reescribir la ganancia de meses pasados.';

-- ----------------------------------------------------------------------------
-- Relleno del histórico
-- ----------------------------------------------------------------------------
--
-- Los pedidos que ya existen se quedan en 0 y así deben quedarse: inventar un
-- costo retroactivo produciría una ganancia que nadie puede auditar. Un cero
-- es honesto — dice "de este pedido no sabemos el costo" — y la pantalla lo
-- distingue de un margen de verdad.
--
-- No hay nada que rellenar aquí. Queda escrito para que nadie lo añada después
-- creyendo que se olvidó.

-- ----------------------------------------------------------------------------
-- Índice
-- ----------------------------------------------------------------------------
--
-- Los reportes agrupan por producto sobre renglones de un rango de fechas. El
-- índice que ya existe sobre `pedido_id` sigue sirviendo; el costo viaja en la
-- misma fila y no necesita uno propio.
