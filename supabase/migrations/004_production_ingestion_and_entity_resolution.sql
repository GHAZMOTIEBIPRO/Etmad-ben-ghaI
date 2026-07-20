create extension if not exists pg_trgm;

create table if not exists public.source_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_fetched integer not null default 0,
  records_staged integer not null default 0,
  records_upserted integer not null default 0,
  retry_count integer not null default 0,
  parser_version text,
  http_status integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists source_runs_source_started_idx on public.source_runs(source_key, started_at desc);
create index if not exists source_runs_status_idx on public.source_runs(status, started_at desc);

create table if not exists public.raw_source_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_external_id text not null,
  source_url text,
  fetched_at timestamptz not null default now(),
  source_updated_at timestamptz,
  content_hash text not null,
  parser_version text,
  parse_status text not null default 'parsed',
  raw_payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_key, source_external_id)
);

create index if not exists raw_source_items_source_idx on public.raw_source_items(source_key, fetched_at desc);
create index if not exists raw_source_items_hash_idx on public.raw_source_items(content_hash);

create table if not exists public.http_fetch_state (
  url text primary key,
  source_key text not null,
  etag text,
  last_modified text,
  last_status integer,
  content_hash text,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  consecutive_failures integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  canonical_name text not null,
  alias text not null,
  normalized_alias text not null,
  source_key text,
  confidence numeric not null default 1.0 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (entity_type, normalized_alias)
);

create index if not exists entity_aliases_normalized_trgm_idx on public.entity_aliases using gin(normalized_alias gin_trgm_ops);

alter table public.projects add column if not exists normalized_owner text not null default '';
alter table public.projects add column if not exists city_name text;
alter table public.projects add column if not exists latitude double precision;
alter table public.projects add column if not exists longitude double precision;

create index if not exists projects_normalized_name_trgm_idx on public.projects using gin(normalized_name gin_trgm_ops);
create index if not exists projects_normalized_owner_trgm_idx on public.projects using gin(normalized_owner gin_trgm_ops);
create index if not exists projects_stage_region_idx on public.projects(stage, region_name);
create index if not exists projects_region_sector_idx on public.projects(region_name, sector);
create index if not exists projects_fit_seen_idx on public.projects(fit_score desc, last_seen_at desc nulls last);

alter table public.project_opportunities add column if not exists tender_id text references public.tenders(id) on delete set null;
create index if not exists project_opportunities_tender_idx on public.project_opportunities(tender_id);

create table if not exists public.project_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  incoming_project_id text not null,
  candidate_project_id text not null references public.projects(id) on delete cascade,
  similarity_score numeric not null,
  status text not null default 'pending',
  reasons jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (incoming_project_id, candidate_project_id)
);

create table if not exists public.public_dataset_rows (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  dataset_external_id text not null,
  row_number integer not null,
  content_hash text not null,
  title text,
  region text,
  city text,
  entity_name text,
  estimated_value numeric,
  event_date timestamptz,
  row_data jsonb not null,
  ingested_at timestamptz not null default now(),
  unique (source_key, dataset_external_id, content_hash)
);

create index if not exists public_dataset_rows_dataset_idx on public.public_dataset_rows(source_key, dataset_external_id);
create index if not exists public_dataset_rows_region_idx on public.public_dataset_rows(region);
create index if not exists public_dataset_rows_title_trgm_idx on public.public_dataset_rows using gin(title gin_trgm_ops);

create or replace function public.normalize_market_text(input text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(input, '')), 'أإآةى', 'اااهي'),
    '[^[:alnum:]\u0600-\u06FF]+', ' ', 'g'
  ));
$$;

create or replace function public.find_project_match(
  p_name text,
  p_owner text,
  p_region text,
  p_threshold real default 0.82
)
returns table(project_id text, match_score real)
language sql
stable
as $$
  with input as (
    select
      public.normalize_market_text(p_name) as normalized_name,
      public.normalize_market_text(p_owner) as normalized_owner,
      coalesce(p_region, '') as region_name
  ), scored as (
    select
      p.id,
      (
        similarity(p.normalized_name, i.normalized_name) * 0.62 +
        similarity(p.normalized_owner, i.normalized_owner) * 0.25 +
        case
          when i.region_name = '' or p.region_name is null then 0.07
          when p.region_name = i.region_name then 0.13
          else 0
        end
      )::real as score
    from public.projects p
    cross join input i
    where
      p.normalized_name % i.normalized_name
      or similarity(p.normalized_name, i.normalized_name) >= 0.55
  )
  select id, score
  from scored
  where score >= p_threshold
  order by score desc
  limit 1;
$$;

create or replace view public.project_search_view as
select
  p.*,
  coalesce(s.source_count, 0)::integer as source_count,
  coalesce(o.opportunity_count, 0)::integer as opportunity_count
from public.projects p
left join (
  select project_id, count(*) as source_count
  from public.project_sources
  group by project_id
) s on s.project_id = p.id
left join (
  select project_id, count(*) as opportunity_count
  from public.project_opportunities
  group by project_id
) o on o.project_id = p.id;

alter table public.source_runs enable row level security;
alter table public.raw_source_items enable row level security;
alter table public.http_fetch_state enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.project_merge_candidates enable row level security;
alter table public.public_dataset_rows enable row level security;

-- Writes remain server-side through the Supabase service-role key.
