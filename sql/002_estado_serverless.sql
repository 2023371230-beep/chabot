-- ============================================================================
-- 002 — Estado que sobrevive a un servidor sin memoria
-- ============================================================================
--
-- POR QUE EXISTE ESTE ARCHIVO
--
-- El bot guardaba en memoria del proceso cuatro cosas: la cotizacion
-- pendiente, la pregunta de kilos pendiente, la huella del ultimo pedido y el
-- contador de peticiones a la IA. En un servidor Express que corre todo el dia
-- eso funciona perfecto.
--
-- En Vercel no. Cada peticion puede caer en una instancia distinta, y las
-- instancias se apagan solas cuando no hay trafico. Con memoria de proceso, en
-- produccion pasaria esto:
--
--   Bot: "Le sale en $1,900. Se lo aparto?"
--   Cliente: "si porfa"                        -> otra instancia, no sabe nada
--   Bot: "No alcance a identificar el pedido."
--
-- Y peor: la huella que evita crear el mismo pedido dos veces tampoco
-- sobreviviria, asi que un cliente que reenvia su mensaje se llevaria el doble
-- de pollo. Lo mismo con el presupuesto de IA: cada instancia empezaria a
-- contar desde cero y entre todas se pasarian de las 1000 peticiones diarias.
--
-- Este archivo mueve ese estado a la base, que es el unico lugar que todas las
-- instancias comparten.
--
-- Se puede correr las veces que haga falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Registro de peticiones a la IA
-- ----------------------------------------------------------------------------
--
-- Una fila por llamada a Groq. Suena a mucho, pero son ~1000 filas al dia como
-- maximo (ese ES el limite de la cuenta), y tener el detalle permite contar por
-- dia, por minuto y por telefono con la misma tabla.

create table if not exists public.ia_peticiones (
  id         uuid        primary key default gen_random_uuid(),
  telefono   text        not null,
  created_at timestamptz not null default now()
);

-- Los tres conteos del presupuesto van por tiempo, siempre hacia atras.
create index if not exists idx_ia_peticiones_fecha
  on public.ia_peticiones (created_at desc);

create index if not exists idx_ia_peticiones_telefono
  on public.ia_peticiones (telefono, created_at desc);

comment on table public.ia_peticiones is
  'Una fila por peticion a Groq. Sostiene el presupuesto compartido entre instancias.';

-- ----------------------------------------------------------------------------
-- El presupuesto, resuelto en una sola consulta
-- ----------------------------------------------------------------------------
--
-- Devuelve el veredicto y los tres contadores de una vez. Se hace en SQL y no
-- en TypeScript para que sea UNA ida a la base por mensaje en vez de tres: en
-- serverless cada viaje de red se paga en latencia que el cliente siente.
--
-- Los limites, medidos contra las cabeceras reales de Groq:
--   x-ratelimit-limit-requests: 1000  por dia   -> se corta en 900, el resto es colchon
--   x-ratelimit-limit-tokens:   8000  por minuto -> 15 peticiones x ~400 tokens = 6000

create or replace function public.presupuesto_ia(
  p_telefono         text,
  p_tope_diario      int default 900,
  p_tope_minuto      int default 15,
  p_tope_telefono    int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy      int;
  v_minuto   int;
  v_telefono int;
begin
  -- "Hoy" es el dia natural en Mexico, no en UTC: si no, el presupuesto se
  -- reiniciaria a las 6 de la tarde, a media jornada de venta.
  select count(*) into v_hoy
    from public.ia_peticiones
   where created_at >= date_trunc('day', now() at time zone 'America/Mexico_City')
                       at time zone 'America/Mexico_City';

  select count(*) into v_minuto
    from public.ia_peticiones
   where created_at > now() - interval '1 minute';

  select count(*) into v_telefono
    from public.ia_peticiones
   where telefono = p_telefono
     and created_at > now() - interval '1 hour';

  return jsonb_build_object(
    'permitido', v_hoy < p_tope_diario
                 and v_minuto < p_tope_minuto
                 and v_telefono < p_tope_telefono,
    'motivo', case
                when v_hoy      >= p_tope_diario   then 'dia'
                when v_minuto   >= p_tope_minuto   then 'minuto'
                when v_telefono >= p_tope_telefono then 'telefono'
                else null
              end,
    'usadas_hoy', v_hoy,
    'en_el_minuto', v_minuto,
    'del_telefono', v_telefono,
    'tope_diario', p_tope_diario,
    'restantes_hoy', greatest(0, p_tope_diario - v_hoy)
  );
end;
$$;

comment on function public.presupuesto_ia is
  'Veredicto y contadores del presupuesto de IA en una sola ida a la base.';

-- ----------------------------------------------------------------------------
-- Limpieza
-- ----------------------------------------------------------------------------
--
-- El registro solo sirve para ventanas de un dia hacia atras. Sin esto la
-- tabla crece para siempre y los conteos se van haciendo lentos.

create or replace function public.limpiar_ia_peticiones()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas int;
begin
  delete from public.ia_peticiones
   where created_at < now() - interval '3 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
--
-- Misma decision que en 001: el backend usa service_role y RLS queda cerrado
-- para todos los demas. Los GRANT van explicitos porque en Supabase el
-- service_role NO hereda privilegios sobre tablas nuevas — es la trampa que ya
-- costo un "permission denied for table productos" en su momento.

alter table public.ia_peticiones enable row level security;

revoke all on public.ia_peticiones from public, anon, authenticated;
grant all privileges on public.ia_peticiones to service_role;

-- OJO: PostgreSQL le da EXECUTE a PUBLIC en toda funcion nueva, y anon hereda
-- de PUBLIC. Revocar solo a anon y authenticated dejaria la funcion abierta
-- igual. Primero se le quita a PUBLIC, y despues se concede a quien debe.
revoke execute on function public.presupuesto_ia(text, int, int, int) from public;
revoke execute on function public.limpiar_ia_peticiones() from public;

grant execute on function public.presupuesto_ia(text, int, int, int) to service_role;
grant execute on function public.limpiar_ia_peticiones() to service_role;
