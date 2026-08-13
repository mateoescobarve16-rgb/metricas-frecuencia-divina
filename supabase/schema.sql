-- Ejecutar en el SQL Editor del dashboard de Supabase (mismo proyecto que usan los otros
-- productos, wqzuvkqutmumwpeuqfyr). Todo vive en un schema propio, separado de "public"
-- (donde está leads_compras y el resto de tablas del bot de WhatsApp) — no se toca ni se
-- depende de nada existente.

create schema if not exists panel_metricas;

create table if not exists panel_metricas.hotmart_ventas (
  id bigint generated always as identity primary key,
  transaction_id text not null unique,
  fecha_venta timestamptz,
  sincronizado_en timestamptz not null default now(),
  payload jsonb not null
);

alter table panel_metricas.hotmart_ventas enable row level security;

-- Sin policies: nadie con la clave "anon"/pública puede leer ni escribir aquí.
-- El cron diario escribe usando la service_role key, que ignora RLS por diseño.
