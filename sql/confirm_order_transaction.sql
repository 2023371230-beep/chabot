-- RPC opcional para una version de produccion.
-- Objetivo: confirmar pedido y descontar inventario en una sola transaccion PostgreSQL.
-- Este archivo no se ejecuta automaticamente en el MVP.

create or replace function public.confirm_order_transaction(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_pedido record;
  v_detalle record;
  v_stock numeric;
  v_existing_sales integer;
begin
  select *
  into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0001';
  end if;

  if v_pedido.estado = 'cancelado' then
    raise exception 'No se puede confirmar un pedido cancelado' using errcode = 'P0001';
  end if;

  select count(*)
  into v_existing_sales
  from public.inventario_movimientos
  where pedido_id = p_pedido_id
    and tipo = 'venta';

  if v_existing_sales > 0 then
    update public.pedidos
    set estado = 'confirmado',
        updated_at = now()
    where id = p_pedido_id;

    return jsonb_build_object(
      'pedido_id', p_pedido_id,
      'warnings', jsonb_build_array('El pedido ya tenia movimientos de venta; no se duplico inventario.')
    );
  end if;

  for v_detalle in
    select producto_id, sum(kg)::numeric as kg
    from public.pedido_detalles
    where pedido_id = p_pedido_id
    group by producto_id
  loop
    select stock_actual
    into v_stock
    from public.productos
    where id = v_detalle.producto_id
    for update;

    if not found then
      raise exception 'Producto no encontrado: %', v_detalle.producto_id using errcode = 'P0001';
    end if;

    if v_stock < v_detalle.kg then
      raise exception 'Stock insuficiente para realizar este movimiento.' using errcode = 'P0001';
    end if;
  end loop;

  for v_detalle in
    select producto_id, kg
    from public.pedido_detalles
    where pedido_id = p_pedido_id
  loop
    insert into public.inventario_movimientos (
      producto_id,
      tipo,
      cantidad_kg,
      motivo,
      pedido_id
    )
    values (
      v_detalle.producto_id,
      'venta',
      v_detalle.kg,
      'Venta por pedido confirmado',
      p_pedido_id
    );

    update public.productos
    set stock_actual = stock_actual - v_detalle.kg,
        updated_at = now()
    where id = v_detalle.producto_id;
  end loop;

  update public.pedidos
  set estado = 'confirmado',
      updated_at = now()
  where id = p_pedido_id;

  return jsonb_build_object('pedido_id', p_pedido_id, 'warnings', jsonb_build_array());
end;
$$;
