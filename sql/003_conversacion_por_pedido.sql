-- ============================================================================
-- 003 — La conversación que produjo cada pedido
-- ============================================================================
--
-- POR QUÉ EXISTE ESTE ARCHIVO
--
-- Los mensajes de WhatsApp ya se guardaban todos: el del cliente y el del bot,
-- con teléfono, texto y hora. Lo que NO se guardaba era de qué conversación
-- salió cada pedido, así que al abrir un pedido no había forma de ver por qué
-- se hizo así.
--
-- El esquema original preveía el enlace (`mensajes_whatsapp.conversacion_id`,
-- `conversaciones_whatsapp.pedido_id`) pero nada lo escribía nunca: cero
-- conversaciones registradas y las columnas en NULL en los 26 mensajes.
--
-- CÓMO SE ENLAZA, Y POR QUÉ ASÍ
--
-- Se marca el pedido en cada MENSAJE, no en la conversación. Un cliente que
-- vuelve la semana siguiente sigue teniendo una sola conversación abierta, y
-- si el enlace viviera ahí el segundo pedido pisaría al primero. Marcando el
-- mensaje, cada pedido se queda exactamente con los suyos.
--
-- La regla de reparto es simple y no necesita ventanas de tiempo ni
-- suposiciones: al crear un pedido se le asignan TODOS los mensajes de ese
-- teléfono que aún no tengan dueño. Los pedidos anteriores ya reclamaron los
-- suyos, así que lo que queda suelto es, por definición, lo que llevó a este.
--
-- Se puede correr las veces que haga falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- La columna
-- ----------------------------------------------------------------------------

alter table public.mensajes_whatsapp
  add column if not exists pedido_id uuid
    references public.pedidos(id) on delete set null;

comment on column public.mensajes_whatsapp.pedido_id is
  'Pedido que salio de este mensaje. NULL = todavia no llevo a ninguno.';

-- Índice para la consulta que hace la pantalla de detalle: dame los mensajes
-- de ESTE pedido, en orden.
create index if not exists idx_mensajes_pedido
  on public.mensajes_whatsapp (pedido_id, created_at)
  where pedido_id is not null;

-- Y el que sostiene el reparto: los mensajes sueltos de un teléfono.
create index if not exists idx_mensajes_sin_pedido
  on public.mensajes_whatsapp (telefono, created_at)
  where pedido_id is null and deleted_at is null;

-- ----------------------------------------------------------------------------
-- El reparto
-- ----------------------------------------------------------------------------
--
-- Se hace en SQL y no en TypeScript por una razón concreta: dos mensajes del
-- mismo cliente pueden estar procesándose a la vez en dos instancias de
-- Vercel. Un `select` seguido de un `update` desde la aplicación deja una
-- ventana en la que los dos reclaman los mismos mensajes. Un solo `update`
-- atómico no la tiene.

create or replace function public.asignar_conversacion_a_pedido(
  p_pedido_id uuid,
  p_telefono  text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marcados int;
begin
  update public.mensajes_whatsapp
     set pedido_id = p_pedido_id,
         updated_at = now()
   where telefono = p_telefono
     and pedido_id is null
     and deleted_at is null;

  get diagnostics v_marcados = row_count;
  return v_marcados;
end;
$$;

comment on function public.asignar_conversacion_a_pedido is
  'Marca como pertenecientes a un pedido los mensajes sueltos de ese telefono.';

-- ----------------------------------------------------------------------------
-- Relleno del histórico
-- ----------------------------------------------------------------------------
--
-- Los pedidos que ya existen no tienen forma de saber cuáles fueron sus
-- mensajes: el dato nunca se guardó. Lo único disponible es el teléfono y la
-- hora, así que se reparte en orden cronológico aplicando la misma regla — a
-- cada pedido, los mensajes de su teléfono anteriores a él que sigan sueltos.
--
-- Es una APROXIMACIÓN y conviene saberlo: si un cliente escribió varias veces
-- antes de que se creara el pedido, todos esos mensajes le quedan colgados.
-- Para los pedidos nuevos el enlace es exacto, porque se marca en el momento.
--
-- Solo toca pedidos de origen 'whatsapp': los capturados desde el panel no
-- tuvieron conversación y deben quedarse sin ella.

do $$
declare
  r record;
  v_total int := 0;
  v_n int;
begin
  for r in
    select p.id, c.telefono, p.created_at
      from public.pedidos p
      join public.clientes c on c.id = p.cliente_id
     where p.origen = 'whatsapp'
       and p.deleted_at is null
     order by p.created_at asc
  loop
    update public.mensajes_whatsapp
       set pedido_id = r.id,
           updated_at = now()
     where telefono = r.telefono
       and pedido_id is null
       and deleted_at is null
       -- Margen de 30 s hacia adelante: la respuesta del bot se guarda unos
       -- instantes DESPUES de que el pedido quede creado.
       and created_at <= r.created_at + interval '30 seconds';

    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  raise notice 'Relleno historico: % mensajes enlazados a pedidos', v_total;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
--
-- Igual que en 001 y 002: el backend usa service_role y RLS queda cerrado para
-- todos los demas. PostgreSQL le da EXECUTE a PUBLIC en toda funcion nueva y
-- anon hereda de PUBLIC, asi que primero se le quita a PUBLIC.

revoke execute on function public.asignar_conversacion_a_pedido(uuid, text) from public;
grant execute on function public.asignar_conversacion_a_pedido(uuid, text) to service_role;
