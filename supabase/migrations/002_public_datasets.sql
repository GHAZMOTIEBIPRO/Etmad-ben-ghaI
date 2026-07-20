create extension if not exists pg_trgm;

create table if not exists public.public_datasets (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  external_id text not null,
  title text not null,
  description text not null default '',
  organization text,
  category text,
  format text,
  dataset_url text,
  resource_url text,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, external_id)
);

create index if not exists public_datasets_source_key_idx on public.public_datasets (source_key);
create index if not exists public_datasets_updated_idx on public.public_datasets (source_updated_at desc nulls last);
create index if not exists public_datasets_title_trgm_idx on public.public_datasets using gin (title gin_trgm_ops);
create index if not exists public_datasets_metadata_gin_idx on public.public_datasets using gin (metadata);

alter table public.public_datasets enable row level security;
-- No public policies: server-side application access uses the Supabase service-role key.
