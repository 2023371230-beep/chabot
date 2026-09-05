-- ============================================================================
-- POLLITO - ESQUEMA COMPLETO DE BASE DE DATOS
-- ----------------------------------------------------------------------------
-- Motor      : PostgreSQL (Supabase)
-- Ejecucion  : Supabase Dashboard > SQL Editor > pegar todo > Run
-- Idempotente: si, se puede volver a ejecutar sin romper nada.
--
-- ORDEN DEL ARCHIVO
--   00. Extensiones
--   01. Funciones reutilizables (updated_at)
--   02. Tablas base            (sin dependencias)
--   03. Tablas dependientes    (con foreign keys)
--   04. Tablas de WhatsApp     (conversaciones con estado)
--   05. Triggers de columnas automaticas (updated_at, subtotal)
--   06. Tabla y triggers de auditoria
--   07. Funcion confirmar_pedido (transaccion atomica e idempotente)
--   08. Indices
--   09. Row Level Security
--   10. Vista materializada resumen_dashboard
--   11. Datos semilla
-- ============================================================================


-- ============================================================================
-- 00. EXTENSIONES
-- ----------------------------------------------------------------------------
-- gen_random_uuid() es nativo desde PostgreSQL 13, pero pgcrypto lo garantiza
-- en cualquier version. Supabase ya lo trae activo: esto es un no-op.
-- ============================================================================

create extension if not exists pgcrypto;


-- ============================================================================
-- 01. FUNCION REUTILIZABLE DE updated_at
-- ----------------------------------------------------------------------------
-- Una sola funcion para todas las tablas. La base de datos mantiene updated_at
-- sola: el backend nunca tiene que acordarse de mandarlo.
-- ============================================================================

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- 02. TABLAS BASE (sin dependencias)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- configuracion_empresa
-- Reglas del negocio editables desde el dashboard. Fila unica en la practica.
--
-- IMPORTANTE: el backend hace `.insert({})` sin columnas cuando no encuentra
-- configuracion (configuracion.service.ts). Por eso TODAS las columnas tienen
-- DEFAULT: si alguna fuera NOT NULL sin default, ese insert reventaria.
--
-- horario_* es TEXT y no TIME a proposito: el backend valida con el regex
-- /^([01]\d|2[0-3]):[0-5]\d$/ (HH:MM). Un TIME de PostgreSQL regresa
-- '08:00:00' por PostgREST y ese valor NO pasa el regex al reeditarlo.
-- ----------------------------------------------------------------------------
create table if not exists public.configuracion_empresa (
  id                       uuid        primary key default gen_random_uuid(),
  kg_limite_rapido         numeric(10,3) not null default 50
                             check (kg_limite_rapido > 0),
  dias_preparacion_mayoreo integer     not null default 2
                             check (dias_preparacion_mayoreo between 0 and 30),
  horario_apertura         text        not null default '08:00'
                             check (horario_apertura ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  horario_cierre           text        not null default '18:00'
                             check (horario_cierre ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  mensaje_fuera_horario    text        default 'Gracias por escribir. Nuestro horario de atencion es de 8:00 a 18:00. Te respondemos en cuanto abramos.',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz default null,
  constraint configuracion_horario_coherente
    check (horario_apertura < horario_cierre)
);

comment on table public.configuracion_empresa is
  'Reglas de negocio configurables. Se espera una sola fila activa.';


-- ----------------------------------------------------------------------------
-- productos
-- Catalogo de cortes de pollo. Todo se vende por kilogramo.
--
-- precio_kg y stock_* son NUMERIC, nunca FLOAT: con dinero y peso los errores
-- de redondeo binario de FLOAT se acumulan y descuadran el inventario.
-- ----------------------------------------------------------------------------
create table if not exists public.productos (
  id            uuid          primary key default gen_random_uuid(),
  nombre        text          not null check (length(trim(nombre)) > 0),
  categoria     text          default 'pollo',
  precio_kg     numeric(10,2) not null default 0 check (precio_kg >= 0),
  stock_actual  numeric(10,3) not null default 0 check (stock_actual >= 0),
  stock_minimo  numeric(10,3) not null default 0 check (stock_minimo >= 0),
  activo        boolean       not null default true,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  deleted_at    timestamptz   default null
);

comment on column public.productos.stock_actual is
  'Se descuenta SOLO al confirmar un pedido, nunca al crearlo. El CHECK >= 0 es la ultima red de seguridad contra stock negativo.';


-- ----------------------------------------------------------------------------
-- clientes
-- El telefono es la identidad del cliente: es la unica llave que tiene el
-- chatbot de WhatsApp para reconocer a quien le escribe.
--
-- El backend usa .maybeSingle() al buscar por telefono, lo que REVIENTA si hay
-- dos filas con el mismo numero. Por eso el indice unico de la seccion 08 no
-- es opcional, es un requisito del codigo.
-- ----------------------------------------------------------------------------
create table if not exists public.clientes (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text,
  telefono   text        not null check (length(trim(telefono)) > 0),
  direccion  text,
  notas      text,
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null
);

comment on column public.clientes.telefono is
  'Formato internacional sin +, como lo manda Meta: 527352233942.';


-- ============================================================================
-- 03. TABLAS DEPENDIENTES (con foreign keys)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pedidos
-- total_kg y total_precio se guardan calculados (denormalizados) a proposito:
-- el dashboard lista pedidos constantemente y recalcular el total sumando los
-- detalles en cada consulta es trabajo desperdiciado.
--
-- confirmado_at existe para poder responder "cuantos pedidos se confirmaron
-- hoy" sin adivinar a partir de updated_at, que cambia por cualquier edicion.
--
-- ON DELETE RESTRICT en cliente_id: un cliente con historial no se borra.
-- ----------------------------------------------------------------------------
create table if not exists public.pedidos (
  id            uuid          primary key default gen_random_uuid(),
  cliente_id    uuid          not null references public.clientes(id) on delete restrict,
  fecha_entrega date,
  estado        text          not null default 'pendiente'
                  check (estado in ('pendiente','confirmado','completado','cancelado')),
  origen        text          not null default 'whatsapp'
                  check (origen in ('whatsapp','dashboard','manual')),
  notas         text,
  total_kg      numeric(10,3) not null default 0 check (total_kg >= 0),
  total_precio  numeric(12,2) not null default 0 check (total_precio >= 0),
  requiere_mayoreo boolean    not null default false,
  confirmado_at timestamptz,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  deleted_at    timestamptz   default null
);

comment on column public.pedidos.requiere_mayoreo is
  'true cuando total_kg supera configuracion_empresa.kg_limite_rapido. Lo calcula el backend al crear el pedido.';


-- ----------------------------------------------------------------------------
-- pedido_detalles
-- Renglones del pedido. El nombre de la tabla NO es negociable: el backend la
-- llama asi en el embed de PostgREST
-- (`select('*, clientes(*), pedido_detalles(*, productos(*))')`).
--
-- precio_kg se COPIA aqui, no se lee de productos: si manana sube el precio
-- del pollo, los pedidos viejos deben conservar el precio al que se vendieron.
--
-- subtotal NO es una columna GENERATED aunque lo parezca: el backend ya manda
-- subtotal en el insert (pedidos.service.ts) y PostgreSQL rechaza cualquier
-- insert explicito sobre una columna GENERATED ALWAYS. En su lugar, el trigger
-- de la seccion 05 lo recalcula siempre. Resultado igual de confiable, pero
-- sin romper el codigo que ya existe.
--
-- ON DELETE CASCADE: los renglones no tienen vida propia sin su pedido.
-- ----------------------------------------------------------------------------
create table if not exists public.pedido_detalles (
  id          uuid          primary key default gen_random_uuid(),
  pedido_id   uuid          not null references public.pedidos(id) on delete cascade,
  producto_id uuid          not null references public.productos(id) on delete restrict,
  kg          numeric(10,3) not null check (kg > 0),
  precio_kg   numeric(10,2) not null check (precio_kg >= 0),
  subtotal    numeric(12,2) not null default 0 check (subtotal >= 0),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  deleted_at  timestamptz   default null
);


-- ----------------------------------------------------------------------------
-- inventario_movimientos
-- Libro mayor del inventario: append-only. productos.stock_actual es el saldo,
-- esta tabla es la explicacion de como se llego a ese saldo.
--
-- ON DELETE SET NULL en pedido_id: si un pedido desaparece, el movimiento de
-- inventario NO debe desaparecer con el, o el stock quedaria sin justificar.
-- ----------------------------------------------------------------------------
create table if not exists public.inventario_movimientos (
  id          uuid          primary key default gen_random_uuid(),
  producto_id uuid          not null references public.productos(id) on delete restrict,
  tipo        text          not null
                check (tipo in ('entrada','venta','ajuste','merma')),
  cantidad_kg numeric(10,3) not null check (cantidad_kg > 0),
  motivo      text,
  usuario_id  uuid          references auth.users(id) on delete set null,
  pedido_id   uuid          references public.pedidos(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  deleted_at  timestamptz   default null
);

comment on column public.inventario_movimientos.cantidad_kg is
  'Siempre positivo. El signo lo determina "tipo": entrada/ajuste suman, venta/merma restan.';


-- ============================================================================
-- 04. TABLAS DE WHATSAPP (conversaciones con estado)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- conversaciones_whatsapp
-- Un pedido por WhatsApp casi nunca llega en un solo mensaje:
--
--   Cliente: "quiero pollo"          -> falta cuanto y de que corte
--   Bot:     "cuantos kg y de que corte?"
--   Cliente: "20 de pechuga"         -> ya hay producto y kg, falta la fecha
--   Bot:     "para que dia?"
--   Cliente: "el viernes"            -> ya se puede armar el pedido
--
-- Sin esta tabla cada mensaje llegaria sin memoria y el bot volveria a empezar.
--
-- `estado` es la maquina de estados de la conversacion.
-- `contexto` (JSONB) acumula lo que la IA ya extrajo entre mensajes.
-- `expira_at` cierra conversaciones abandonadas para que un "si" mandado tres
--   dias despues no confirme un pedido viejo.
-- ----------------------------------------------------------------------------
create table if not exists public.conversaciones_whatsapp (
  id                uuid        primary key default gen_random_uuid(),
  telefono          text        not null check (length(trim(telefono)) > 0),
  cliente_id        uuid        references public.clientes(id) on delete set null,
  estado            text        not null default 'abierta'
                      check (estado in (
                        'abierta',            -- conversacion iniciada, sin intencion clara
                        'recolectando_pedido',-- faltan datos del pedido
                        'esperando_fecha',    -- solo falta la fecha de entrega
                        'esperando_confirmacion', -- resumen enviado, se espera si/no
                        'cerrada',            -- termino bien
                        'escalado_humano'     -- el bot no pudo, lo ve una persona
                      )),
  contexto          jsonb       not null default '{}'::jsonb,
  pedido_id         uuid        references public.pedidos(id) on delete set null,
  ultimo_mensaje_at timestamptz not null default now(),
  expira_at         timestamptz not null default (now() + interval '24 hours'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz default null
);

comment on column public.conversaciones_whatsapp.contexto is
  'Pedido parcial que la IA va armando entre mensajes. Ej: {"productos":[{"nombre":"pechuga","kg":20}],"fecha_entrega":null}';


-- ----------------------------------------------------------------------------
-- mensajes_whatsapp
-- Bitacora de todos los mensajes, entrantes y salientes.
--
-- wa_message_id UNIQUE es la pieza mas importante de esta tabla.
-- Meta REINTENTA el webhook si no recibe un 200 rapido. Sin esta restriccion,
-- un reintento crearia el mismo pedido dos veces. Con ella, el segundo insert
-- falla con codigo 23505 y el backend simplemente lo ignora.
--
-- Las columnas telefono, mensaje, tipo y procesado se conservan con el mismo
-- nombre porque whatsapp.service.ts ya inserta exactamente esas.
-- ----------------------------------------------------------------------------
create table if not exists public.mensajes_whatsapp (
  id             uuid        primary key default gen_random_uuid(),
  conversacion_id uuid       references public.conversaciones_whatsapp(id) on delete set null,
  cliente_id     uuid        references public.clientes(id) on delete set null,
  telefono       text        not null check (length(trim(telefono)) > 0),
  mensaje        text        not null,
  tipo           text        not null default 'cliente'
                   check (tipo in ('cliente','bot','sistema')),
  wa_message_id  text unique,
  procesado      boolean     not null default false,
  intent         text,
  payload        jsonb,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz default null
);

comment on column public.mensajes_whatsapp.wa_message_id is
  'ID del mensaje que manda Meta (wamid.xxx). UNIQUE = a prueba de reintentos del webhook.';
comment on column public.mensajes_whatsapp.payload is
  'Payload crudo de Meta. Sirve para depurar sin tener que reproducir el mensaje.';


-- ============================================================================
-- 05. TRIGGERS DE COLUMNAS AUTOMATICAS (updated_at y subtotal)
-- ----------------------------------------------------------------------------
-- Uno por tabla, todos apuntan a la misma funcion de la seccion 01.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracion_empresa',
    'productos',
    'clientes',
    'pedidos',
    'pedido_detalles',
    'inventario_movimientos',
    'conversaciones_whatsapp',
    'mensajes_whatsapp'
  ]
  loop
    execute format('drop trigger if exists trigger_updated_at_%1$s on public.%1$I', t);
    execute format(
      'create trigger trigger_updated_at_%1$s
         before update on public.%1$I
         for each row execute function public.actualizar_updated_at()', t);
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- subtotal siempre coherente con kg * precio_kg, mande lo que mande el backend.
-- Con esto es imposible que un renglon del pedido tenga un subtotal que no
-- corresponde a su cantidad y su precio.
-- ----------------------------------------------------------------------------
create or replace function public.calcular_subtotal_detalle()
returns trigger
language plpgsql
as $$
begin
  new.subtotal = round(new.kg * new.precio_kg, 2);
  return new;
end;
$$;

drop trigger if exists trigger_subtotal_pedido_detalles on public.pedido_detalles;
create trigger trigger_subtotal_pedido_detalles
  before insert or update of kg, precio_kg on public.pedido_detalles
  for each row execute function public.calcular_subtotal_detalle();


-- ============================================================================
-- 06. AUDITORIA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- La tabla auditoria es la unica SIN updated_at ni deleted_at, y es
-- deliberado: un registro de auditoria que se puede editar o borrar no sirve
-- como registro de auditoria. Es append-only.
--
-- Tampoco tiene foreign key a las tablas auditadas: debe sobrevivir al borrado
-- del registro original, que es justo cuando mas se necesita.
-- ----------------------------------------------------------------------------
create table if not exists public.auditoria (
  id            uuid        primary key default gen_random_uuid(),
  tabla         text        not null,
  operacion     text        not null check (operacion in ('INSERT','UPDATE','DELETE')),
  registro_id   uuid        not null,
  datos_antes   jsonb,
  datos_despues jsonb,
  usuario_id    uuid,
  ip_origen     text,
  created_at    timestamptz not null default now()
);

comment on table public.auditoria is
  'Bitacora append-only de cambios en tablas criticas. Sin FK a proposito: sobrevive al borrado del registro original.';


create or replace function public.auditar_cambios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un UPDATE que no cambio nada no merece un registro de auditoria.
  -- Sin esto, cada confirmacion de pedido ensuciaria la bitacora con ruido.
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  insert into public.auditoria (tabla, operacion, registro_id, datos_antes, datos_despues)
  values (
    tg_table_name,
    tg_op,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;


-- Triggers de auditoria SOLO en las tablas criticas: las que mueven dinero o
-- inventario. Auditar todo generaria mas ruido que valor.
do $$
declare
  t text;
begin
  foreach t in array array['pedidos','productos','inventario_movimientos']
  loop
    execute format('drop trigger if exists trigger_auditoria_%1$s on public.%1$I', t);
    execute format(
      'create trigger trigger_auditoria_%1$s
         after insert or update or delete on public.%1$I
         for each row execute function public.auditar_cambios()', t);
  end loop;
end;
$$;


-- ============================================================================
-- 07. FUNCION confirmar_pedido
-- ----------------------------------------------------------------------------
-- Confirmar un pedido son tres cosas que deben pasar todas o ninguna:
--   1. descontar stock de cada producto
--   2. registrar el movimiento de venta
--   3. cambiar el estado del pedido
--
-- Hacerlo desde el backend con tres queries sueltas deja una ventana en la que
-- el stock ya se descontó pero el pedido sigue pendiente. Aqui es una sola
-- transaccion: si algo truena, PostgreSQL revierte todo.
--
-- IDEMPOTENCIA: llamarla dos veces NO descuenta el stock dos veces.
--
-- DEADLOCKS: los productos se bloquean ordenados por id. Si dos pedidos
-- comparten productos, ambos los toman en el mismo orden y no se traban.
--
-- Todas las validaciones ocurren ANTES de la primera escritura. Asi un
-- `return` de error nunca deja cambios a medias.
--
-- Uso desde el backend:
--   const { data } = await supabase.rpc('confirmar_pedido', { p_pedido_id: id });
-- ============================================================================

create or replace function public.confirmar_pedido(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido      public.pedidos%rowtype;
  v_detalle     record;
  v_stock       numeric(10,3);
  v_nombre      text;
  v_faltantes   text[] := '{}';
  v_num_items   integer;
begin
  ---------------------------------------------------------------------------
  -- 1. Tomar el pedido y bloquearlo hasta el final de la transaccion
  ---------------------------------------------------------------------------
  select * into v_pedido
  from public.pedidos
  where id = p_pedido_id
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  end if;

  if v_pedido.estado = 'cancelado' then
    return jsonb_build_object('success', false, 'error', 'No se puede confirmar un pedido cancelado');
  end if;

  ---------------------------------------------------------------------------
  -- 2. Idempotencia: si ya se confirmo, no se vuelve a descontar stock
  ---------------------------------------------------------------------------
  if v_pedido.estado in ('confirmado','completado')
     or exists (
       select 1 from public.inventario_movimientos
       where pedido_id = p_pedido_id and tipo = 'venta'
     )
  then
    -- Caso raro: hay movimientos de venta pero el estado se quedo atras.
    -- Se corrige el estado sin tocar el inventario.
    if v_pedido.estado = 'pendiente' then
      update public.pedidos
         set estado = 'confirmado',
             confirmado_at = coalesce(confirmado_at, now())
       where id = p_pedido_id;
    end if;

    return jsonb_build_object(
      'success',      true,
      'pedido_id',    p_pedido_id,
      'ya_confirmado', true,
      'warnings',     jsonb_build_array('El pedido ya tenia movimientos de venta; no se duplico inventario.')
    );
  end if;

  ---------------------------------------------------------------------------
  -- 3. Un pedido sin renglones no se puede confirmar
  ---------------------------------------------------------------------------
  select count(*) into v_num_items
  from public.pedido_detalles
  where pedido_id = p_pedido_id;

  if v_num_items = 0 then
    return jsonb_build_object('success', false, 'error', 'El pedido no tiene productos para confirmar');
  end if;

  ---------------------------------------------------------------------------
  -- 4. Validar stock de TODOS los productos antes de tocar nada.
  --    Se acumulan todos los faltantes para dar un mensaje util al cliente,
  --    en vez de reportar solo el primero que fallo.
  ---------------------------------------------------------------------------
  for v_detalle in
    select d.producto_id, sum(d.kg)::numeric(10,3) as kg
    from public.pedido_detalles d
    where d.pedido_id = p_pedido_id
    group by d.producto_id
    order by d.producto_id            -- orden estable = sin deadlocks
  loop
    select p.stock_actual, p.nombre
      into v_stock, v_nombre
    from public.productos p
    where p.id = v_detalle.producto_id
      and p.deleted_at is null
    for update;

    if not found then
      return jsonb_build_object(
        'success', false,
        'error', 'Producto no encontrado: ' || v_detalle.producto_id::text
      );
    end if;

    if v_stock < v_detalle.kg then
      v_faltantes := v_faltantes || format(
        '%s (solicitado %s kg, disponible %s kg)',
        v_nombre, v_detalle.kg, v_stock
      );
    end if;
  end loop;

  if array_length(v_faltantes, 1) > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Stock insuficiente para realizar este movimiento.',
      'detalle', array_to_string(v_faltantes, '; ')
    );
  end if;

  ---------------------------------------------------------------------------
  -- 5. A partir de aqui solo se escribe. Ya no puede fallar por reglas.
  ---------------------------------------------------------------------------
  for v_detalle in
    select d.producto_id, sum(d.kg)::numeric(10,3) as kg
    from public.pedido_detalles d
    where d.pedido_id = p_pedido_id
    group by d.producto_id
    order by d.producto_id
  loop
    insert into public.inventario_movimientos
      (producto_id, tipo, cantidad_kg, motivo, pedido_id)
    values
      (v_detalle.producto_id, 'venta', v_detalle.kg, 'Venta por pedido confirmado', p_pedido_id);

    update public.productos
       set stock_actual = stock_actual - v_detalle.kg
     where id = v_detalle.producto_id;
  end loop;

  update public.pedidos
     set estado = 'confirmado',
         confirmado_at = now()
   where id = p_pedido_id;

  return jsonb_build_object(
    'success',       true,
    'pedido_id',     p_pedido_id,
    'ya_confirmado', false,
    'total_kg',      v_pedido.total_kg,
    'total_precio',  v_pedido.total_precio,
    'warnings',      jsonb_build_array()
  );
end;
$$;


-- ============================================================================
-- 08. INDICES
-- ----------------------------------------------------------------------------
-- Los indices parciales (WHERE deleted_at is null) son mas chicos y mas
-- rapidos porque solo guardan las filas que realmente se consultan.
-- ============================================================================

-- clientes.telefono: lo consulta el chatbot en CADA mensaje entrante.
-- UNIQUE ademas de rapido, porque el backend usa .maybeSingle() y truena si
-- encuentra dos. Parcial: un cliente borrado no debe bloquear que ese mismo
-- numero se vuelva a registrar.
create unique index if not exists idx_clientes_telefono_unico
  on public.clientes (telefono)
  where deleted_at is null;

-- Evita productos duplicados ("Pechuga" y "pechuga"), que confundirian a la IA
-- al hacer match del nombre que escribio el cliente.
create unique index if not exists idx_productos_nombre_unico
  on public.productos (lower(trim(nombre)))
  where deleted_at is null;

create index if not exists idx_productos_activos
  on public.productos (activo)
  where activo = true and deleted_at is null;

create index if not exists idx_pedidos_estado
  on public.pedidos (estado)
  where deleted_at is null;

create index if not exists idx_pedidos_fecha_entrega
  on public.pedidos (fecha_entrega)
  where deleted_at is null;

create index if not exists idx_pedidos_cliente
  on public.pedidos (cliente_id)
  where deleted_at is null;

-- El dashboard lista pedidos con .order('created_at', ascending: false)
create index if not exists idx_pedidos_created_at
  on public.pedidos (created_at desc)
  where deleted_at is null;

create index if not exists idx_pedido_detalles_pedido
  on public.pedido_detalles (pedido_id);

create index if not exists idx_pedido_detalles_producto
  on public.pedido_detalles (producto_id);

create index if not exists idx_movimientos_producto
  on public.inventario_movimientos (producto_id);

-- Cubre exactamente la consulta de idempotencia de confirmar_pedido:
-- "hay movimientos de venta para este pedido?"
create index if not exists idx_movimientos_pedido_tipo
  on public.inventario_movimientos (pedido_id, tipo);

create index if not exists idx_movimientos_created_at
  on public.inventario_movimientos (created_at desc);

-- Una sola conversacion viva por telefono. Parcial sobre las no cerradas:
-- permite historial de conversaciones pasadas del mismo numero.
create unique index if not exists idx_conversaciones_telefono_activa
  on public.conversaciones_whatsapp (telefono)
  where estado <> 'cerrada' and deleted_at is null;

create index if not exists idx_conversaciones_estado
  on public.conversaciones_whatsapp (estado)
  where deleted_at is null;

create index if not exists idx_mensajes_telefono
  on public.mensajes_whatsapp (telefono, created_at desc);

create index if not exists idx_mensajes_conversacion
  on public.mensajes_whatsapp (conversacion_id, created_at);

-- Para la cola de mensajes que aun no procesa el bot
create index if not exists idx_mensajes_pendientes
  on public.mensajes_whatsapp (created_at)
  where procesado = false;

create index if not exists idx_auditoria_registro
  on public.auditoria (tabla, registro_id, created_at desc);


-- ============================================================================
-- 09. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Modelo de acceso de Pollito:
--   - El admin entra al dashboard con Supabase Auth, pero el frontend NO lee
--     tablas: todo pasa por el backend (verificado en el codigo, el frontend
--     solo usa supabase.auth).
--   - El backend usa SUPABASE_SECRET_KEY (service_role).
--   - Los clientes de WhatsApp no tienen cuenta y nunca tocan la base.
--
-- Por eso: RLS activo en todo, y ninguna politica para anon/authenticated.
--
-- COMO PROTEGE ESTO EN LA PRACTICA: la clave que sale en el navegador
-- (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) es publica y cualquiera la puede
-- leer del bundle. Con RLS activo y sin politicas para anon, esa clave no
-- puede leer ni una fila.
--
-- NOTA HONESTA: service_role IGNORA RLS por diseno en Supabase. Las politicas
-- de abajo son defensa en profundidad y documentacion de la intencion; lo que
-- de verdad bloquea al publico es tener RLS activo SIN politicas permisivas.
-- ============================================================================

grant usage on schema public to service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracion_empresa',
    'productos',
    'clientes',
    'pedidos',
    'pedido_detalles',
    'inventario_movimientos',
    'conversaciones_whatsapp',
    'mensajes_whatsapp',
    'auditoria'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- GRANT explicito a service_role. Supabase normalmente lo concede solo por
    -- privilegios por defecto, pero depender de eso es fragil: si no caen, el
    -- backend truena con "permission denied for table productos" y el error no
    -- apunta a la causa. Hacerlo explicito cuesta nada y elimina el riesgo.
    execute format('grant all privileges on public.%I to service_role', t);

    execute format('drop policy if exists "service_role_acceso_total" on public.%I', t);
    execute format(
      'create policy "service_role_acceso_total" on public.%I
         for all to service_role using (true) with check (true)', t);
  end loop;
end;
$$;


-- ============================================================================
-- 10. VISTA MATERIALIZADA resumen_dashboard
-- ----------------------------------------------------------------------------
-- Precalcula los contadores de la pantalla principal en una sola fila.
--
-- ZONA HORARIA: "hoy" se calcula en America/Mexico_City, no en UTC. Sin esto,
-- entre las 18:00 y la medianoche hora de Mexico el dashboard mostraria los
-- pedidos del dia siguiente.
--
-- El indice UNIQUE de abajo es obligatorio para poder usar
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (refrescar sin bloquear lecturas).
-- ============================================================================

drop materialized view if exists public.resumen_dashboard;

create materialized view public.resumen_dashboard as
select
  1 as id,

  (select count(*) from public.pedidos
    where estado = 'pendiente' and deleted_at is null
  ) as pedidos_pendientes,

  (select count(*) from public.pedidos
    where estado = 'confirmado' and deleted_at is null
  ) as pedidos_confirmados,

  (select count(*) from public.pedidos
    where deleted_at is null
      and confirmado_at is not null
      and (confirmado_at at time zone 'America/Mexico_City')::date
          = (now() at time zone 'America/Mexico_City')::date
  ) as pedidos_confirmados_hoy,

  (select count(*) from public.pedidos
    where deleted_at is null
      and estado in ('pendiente','confirmado')
      and fecha_entrega = (now() at time zone 'America/Mexico_City')::date
  ) as entregas_hoy,

  (select coalesce(sum(total_precio), 0) from public.pedidos
    where deleted_at is null
      and estado in ('confirmado','completado')
      and confirmado_at >= date_trunc('month', now() at time zone 'America/Mexico_City')
  ) as ventas_mes_actual,

  (select coalesce(sum(total_kg), 0) from public.pedidos
    where deleted_at is null
      and estado in ('confirmado','completado')
      and confirmado_at >= date_trunc('month', now() at time zone 'America/Mexico_City')
  ) as kg_mes_actual,

  (select count(*) from public.productos
    where deleted_at is null
      and activo = true
      and stock_actual < stock_minimo
  ) as productos_bajo_minimo,

  now() as actualizado_at;

-- Permite refrescar con CONCURRENTLY desde el SQL Editor si algun dia la vista
-- crece y el refresco empieza a notarse.
create unique index if not exists idx_resumen_dashboard_id
  on public.resumen_dashboard (id);

-- Las vistas materializadas NO soportan RLS. Y Supabase concede privilegios
-- por defecto sobre las relaciones nuevas de public a anon/authenticated, asi
-- que sin este REVOKE la vista quedaria legible con la clave publica del
-- navegador. Es el unico objeto de este esquema que hay que cerrar a mano.
revoke all on public.resumen_dashboard from anon, authenticated;
grant select on public.resumen_dashboard to service_role;


-- ----------------------------------------------------------------------------
-- Helper para refrescar la vista. El backend la puede llamar justo despues de
-- confirmar un pedido, para que el dashboard no muestre numeros viejos en el
-- momento en que mas importa:
--   await supabase.rpc('refrescar_resumen_dashboard');
--
-- El refresco es NO concurrente a proposito: PostgreSQL prohibe
-- REFRESH ... CONCURRENTLY dentro de una funcion (toda funcion corre dentro de
-- una transaccion). Sobre una vista de una sola fila el bloqueo dura
-- milisegundos, asi que no es problema.
-- ----------------------------------------------------------------------------
create or replace function public.refrescar_resumen_dashboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.resumen_dashboard;
end;
$$;


-- ----------------------------------------------------------------------------
-- OPCIONAL - refresco automatico cada 5 minutos con pg_cron.
--
-- Descomentar SOLO despues de activar pg_cron en:
--   Supabase Dashboard > Database > Extensions > buscar "pg_cron" > Enable
--
-- Si se ejecuta sin activar la extension, ABORTA TODO EL SCRIPT.
-- ----------------------------------------------------------------------------
-- select cron.schedule(
--   'refrescar_resumen_dashboard',
--   '*/5 * * * *',
--   $cron$ select public.refrescar_resumen_dashboard() $cron$
-- );


-- ============================================================================
-- 11. DATOS SEMILLA
-- ----------------------------------------------------------------------------
-- Se usa WHERE NOT EXISTS en vez de ON CONFLICT para que el script se pueda
-- volver a correr sin duplicar ni sobrescribir datos que ya edito el admin.
-- ============================================================================

-- Configuracion inicial (una sola fila)
insert into public.configuracion_empresa (
  kg_limite_rapido, dias_preparacion_mayoreo, horario_apertura, horario_cierre
)
select 50, 2, '08:00', '18:00'
where not exists (select 1 from public.configuracion_empresa where deleted_at is null);


-- Catalogo base de cortes. Precios y stock son de arranque: el admin los
-- ajusta desde el dashboard.
insert into public.productos (nombre, categoria, precio_kg, stock_actual, stock_minimo)
select v.nombre, v.categoria, v.precio_kg, v.stock_actual, v.stock_minimo
from (values
  ('Pechuga',        'pollo', 95.00, 100, 20),
  ('Pierna',         'pollo', 72.00, 100, 20),
  ('Muslo',          'pollo', 70.00, 100, 20),
  ('Ala',            'pollo', 68.00,  80, 15),
  ('Pata',           'pollo', 35.00,  50, 10),
  ('Pollo entero',   'pollo', 65.00, 120, 25),
  ('Retazo',         'pollo', 30.00,  40, 10),
  ('Higado',         'visceras', 45.00, 25,  5),
  ('Molleja',        'visceras', 48.00, 25,  5)
) as v(nombre, categoria, precio_kg, stock_actual, stock_minimo)
where not exists (
  select 1 from public.productos p
  where lower(trim(p.nombre)) = lower(trim(v.nombre))
    and p.deleted_at is null
);


-- Deja la vista lista para consultarse
refresh materialized view public.resumen_dashboard;


-- ============================================================================
-- FIN. Verificacion rapida:
--
--   select * from public.resumen_dashboard;
--   select nombre, precio_kg, stock_actual from public.productos order by nombre;
--   select * from public.configuracion_empresa;
-- ============================================================================
