-- Ejecutar en el SQL Editor del dashboard de Supabase (mismo proyecto que usan los otros
-- productos, wqzuvkqutmumwpeuqfyr). Esta tabla es nueva e independiente: no modifica ni
-- depende de leads_compras ni de ninguna otra tabla existente.

create table if not exists public.hotmart_eventos_raw (
  id bigint generated always as identity primary key,
  recibido_en timestamptz not null default now(),
  evento text,
  transaction_id text,
  payload jsonb not null
);

create unique index if not exists hotmart_eventos_raw_dedupe
  on public.hotmart_eventos_raw (transaction_id, evento)
  where transaction_id is not null;

alter table public.hotmart_eventos_raw enable row level security;

-- Sin policies: nadie con la clave "anon"/pública puede leer ni escribir aquí.
-- El endpoint /api/webhooks/hotmart escribe usando la service_role key, que
-- ignora RLS por diseño.
