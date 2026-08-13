-- Ejecutar en el SQL Editor del proyecto de Supabase "metricas-frecuencia-divina"
-- (proyecto dedicado, 100% separado de "Frecuencia Divina" y de "protocolo-cero-inflamacion").

create table if not exists public.hotmart_ventas (
  id bigint generated always as identity primary key,
  transaction_id text not null unique,
  fecha_venta timestamptz,
  sincronizado_en timestamptz not null default now(),
  payload jsonb not null
);

alter table public.hotmart_ventas enable row level security;

-- Sin policies: nadie con la clave "anon"/pública puede leer ni escribir aquí.
-- El cron diario escribe usando la service_role key, que ignora RLS por diseño.
