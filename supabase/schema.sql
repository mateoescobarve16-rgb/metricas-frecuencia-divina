-- Ejecutar en el SQL Editor del proyecto de Supabase "metricas-frecuencia-divina"
-- (proyecto dedicado, 100% separado de "Frecuencia Divina" y de "protocolo-cero-inflamacion").

create table if not exists public.hotmart_ventas (
  id bigint generated always as identity primary key,
  transaction_id text not null unique,
  product_id bigint not null,
  offer_code text not null,
  product_name text,
  status text not null,
  fecha_venta timestamptz not null,
  price_value numeric,
  price_currency text,
  is_subscription boolean not null default false,
  tracking jsonb,
  sincronizado_en timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists hotmart_ventas_fecha_idx on public.hotmart_ventas (fecha_venta);
create index if not exists hotmart_ventas_producto_idx on public.hotmart_ventas (product_id, offer_code);

alter table public.hotmart_ventas enable row level security;

-- Como el proyecto se creó con "Automatically expose new tables" desactivado, hay que
-- otorgar el permiso explícitamente al rol que usa la Secret key. RLS sigue activo (sin
-- policies para anon/authenticated), pero service_role tiene BYPASSRLS a nivel de Postgres.
grant select, insert, update, delete on public.hotmart_ventas to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Sin policies para anon/authenticated: nadie con la clave pública puede leer ni escribir aquí.

-- Nota sobre "categoria" (front_end/upsell_01/etc.): NO se guarda como columna aquí a propósito.
-- Se calcula al momento de leer/agregar, a partir de product_id + offer_code, usando
-- lib/hotmart/mapeoProductos.ts como única fuente de verdad. Así, si el mapeo cambia en el
-- futuro, el histórico ya guardado se re-clasifica solo, sin necesidad de migrar datos.
