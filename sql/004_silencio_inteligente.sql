-- ============================================================================
-- 004 — Silencio inteligente y respuestas desde el panel
-- ============================================================================
--
-- QUÉ RESUELVE
--
-- Hoy el bot solo se calla cuando ÉL decide escalar. Si el dueño agarra su
-- celular y le contesta al cliente, el bot no se entera y sigue respondiendo:
-- dos voces distintas en el mismo chat, y el cliente sin saber a quién le
-- habla.
--
-- DOS CONCEPTOS QUE NO SON EL MISMO
--
-- La propuesta original mezclaba "el bot está callado" con "este chat necesita
-- a una persona", y no son lo mismo:
--
--   · Necesita a una persona  -> aparece en la bandeja hasta que alguien lo
--                                resuelve. Si se limpiara solo, una queja se
--                                perdería sin que nadie la viera.
--   · El bot está callado     -> tiene fecha de caducidad. Si el dueño
--                                interviene y se le olvida reactivar, el
--                                cliente se quedaría mudo para siempre.
--
-- Un reclamo activa las DOS: entra en la bandeja (hasta que se resuelve) y
-- calla al bot 12 horas. Pasadas esas horas el bot vuelve a atender pedidos
-- nuevos — mejor eso que silencio eterno — pero el chat SIGUE en la bandeja
-- para que nadie olvide el reclamo.
--
-- Con caducidad no hace falta ningún proceso nocturno que limpie: el silencio
-- se acaba solo al leerlo.
--
-- Se puede correr las veces que haga falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Un tipo de mensaje más: 'asesor'
-- ----------------------------------------------------------------------------
--
-- Lo que escribe una persona no es del 'bot'. Guardarlo como tal haría que en
-- el hilo las palabras del dueño aparecieran como del asistente, y el día que
-- se revise por qué un cliente se molestó no habría forma de distinguir quién
-- dijo qué.

alter table public.mensajes_whatsapp
  drop constraint if exists mensajes_whatsapp_tipo_check;

alter table public.mensajes_whatsapp
  add constraint mensajes_whatsapp_tipo_check
  check (tipo in ('cliente', 'bot', 'asesor', 'sistema'));

comment on column public.mensajes_whatsapp.tipo is
  'cliente = lo escribio el cliente | bot = lo escribio el asistente | asesor = lo escribio una persona | sistema = un evento, no lo dijo nadie';

-- ----------------------------------------------------------------------------
-- Hasta cuándo se calla el bot
-- ----------------------------------------------------------------------------

alter table public.conversaciones_whatsapp
  add column if not exists pausado_hasta timestamptz default null;

comment on column public.conversaciones_whatsapp.pausado_hasta is
  'El bot no contesta en este chat hasta esta hora. NULL = atiende con normalidad.';

-- Índice parcial: la consulta de cada mensaje entrante es "¿este teléfono está
-- callado ahora?". Solo interesan las filas que tienen fecha.
create index if not exists idx_conversaciones_pausa
  on public.conversaciones_whatsapp (telefono, pausado_hasta)
  where pausado_hasta is not null and deleted_at is null;

-- ----------------------------------------------------------------------------
-- Silenciar
-- ----------------------------------------------------------------------------
--
-- Una sola función para las tres formas de silenciar (el bot escala, el dueño
-- escribe desde el panel, el dueño escribe desde su celular). Crea la
-- conversación si no existe, porque un cliente puede recibir su primera
-- respuesta de una persona antes de que el bot le haya contestado nunca.
--
-- `p_necesita_persona` es lo que decide si además entra en la bandeja: al
-- responder desde el panel el dueño YA está atendiendo, así que no tiene
-- sentido añadirlo a la lista de pendientes.

create or replace function public.silenciar_bot(
  p_telefono          text,
  p_minutos           int  default 120,
  p_necesita_persona  boolean default false
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hasta timestamptz := now() + make_interval(mins => p_minutos);
  v_id    uuid;
begin
  select id into v_id
    from public.conversaciones_whatsapp
   where telefono = p_telefono
     and estado <> 'cerrada'
     and deleted_at is null
   limit 1;

  if v_id is null then
    insert into public.conversaciones_whatsapp (telefono, estado, pausado_hasta)
    values (
      p_telefono,
      case when p_necesita_persona then 'escalado_humano' else 'abierta' end,
      v_hasta
    );
  else
    update public.conversaciones_whatsapp
       set pausado_hasta = v_hasta,
           -- El estado solo SUBE de nivel: responder desde el panel no baja de
           -- 'escalado_humano' a 'abierta' y borra un reclamo de la bandeja.
           estado = case
                      when p_necesita_persona then 'escalado_humano'
                      else estado
                    end,
           ultimo_mensaje_at = now(),
           updated_at = now()
     where id = v_id;
  end if;

  return v_hasta;
end;
$$;

comment on function public.silenciar_bot is
  'Calla al bot en un chat durante N minutos. Opcionalmente lo marca como pendiente de una persona.';

-- ----------------------------------------------------------------------------
-- Devolverle el turno al bot
-- ----------------------------------------------------------------------------
--
-- Lo llama el botón "Devolver al asistente". Limpia las dos cosas a la vez:
-- deja de estar callado y sale de la bandeja.

create or replace function public.reactivar_bot(p_telefono text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  update public.conversaciones_whatsapp
     set pausado_hasta = null,
         estado = 'abierta',
         updated_at = now()
   where telefono = p_telefono
     and estado <> 'cerrada'
     and deleted_at is null;

  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------

revoke execute on function public.silenciar_bot(text, int, boolean) from public;
revoke execute on function public.reactivar_bot(text) from public;

grant execute on function public.silenciar_bot(text, int, boolean) to service_role;
grant execute on function public.reactivar_bot(text) to service_role;
