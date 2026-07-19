create extension if not exists pg_trgm;

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null, base_url text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.government_entities (
  id text primary key, name text not null, slug text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activities (
  id text primary key, name text not null, sector text not null, slug text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.regions (
  id text primary key, name text not null, slug text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.companies (
  id text primary key, name text not null, slug text not null unique, commercial_registration text unique,
  normalized_name text generated always as (lower(trim(name))) stored, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tenders (
  id text primary key, competition_number text not null, name text not null, description text not null default '',
  government_entity_id text not null references public.government_entities(id), activity_id text not null references public.activities(id),
  region_id text not null references public.regions(id), publication_date date not null, submission_deadline date, bid_opening_date date,
  brochure_price numeric(18,2) check (brochure_price is null or brochure_price >= 0), estimated_value numeric(18,2) check (estimated_value is null or estimated_value >= 0),
  status text not null check (status in ('open','closed','awarded','cancelled')), source_external_id text not null unique, source_url text,
  data_source_id uuid references public.data_sources(id), source_updated_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.awards (
  id text primary key, tender_id text not null references public.tenders(id) on delete cascade, company_id text not null references public.companies(id),
  award_date date not null, amount numeric(18,2) not null check (amount >= 0), status text not null default 'announced' check (status in ('announced','final')),
  source_external_id text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tender_id, company_id)
);
create table if not exists public.company_participations (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.companies(id) on delete cascade,
  tender_id text not null references public.tenders(id) on delete cascade, result text not null default 'unknown' check (result in ('won','lost','unknown')),
  bid_amount numeric(18,2) check (bid_amount is null or bid_amount >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (company_id, tender_id)
);
create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(), data_source_id uuid not null references public.data_sources(id), started_at timestamptz not null default now(), completed_at timestamptz,
  status text not null check (status in ('running','success','partial','failed')), fetched_count integer not null default 0 check (fetched_count >= 0),
  upserted_count integer not null default 0 check (upserted_count >= 0), error_count integer not null default 0 check (error_count >= 0), error_message text, created_at timestamptz not null default now()
);

create index if not exists tenders_publication_date_idx on public.tenders (publication_date desc);
create index if not exists tenders_status_idx on public.tenders (status);
create index if not exists tenders_entity_idx on public.tenders (government_entity_id);
create index if not exists tenders_activity_idx on public.tenders (activity_id);
create index if not exists tenders_region_idx on public.tenders (region_id);
create index if not exists tenders_estimated_value_idx on public.tenders (estimated_value);
create index if not exists tenders_name_trgm_idx on public.tenders using gin (name gin_trgm_ops);
create index if not exists tenders_number_trgm_idx on public.tenders using gin (competition_number gin_trgm_ops);
create index if not exists companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);
create index if not exists awards_date_idx on public.awards (award_date desc);
create index if not exists awards_amount_idx on public.awards (amount desc);
create index if not exists awards_company_idx on public.awards (company_id);
create index if not exists participations_tender_idx on public.company_participations (tender_id);
create index if not exists sync_logs_source_status_idx on public.sync_logs (data_source_id, status, completed_at desc);

create or replace view public.tender_search_view as
select t.id,t.competition_number,t.name,t.description,t.government_entity_id,ge.name government_entity_name,ge.slug government_entity_slug,
 t.activity_id,a.name activity_name,a.sector,t.region_id,r.name region_name,t.publication_date,t.submission_deadline,t.bid_opening_date,t.brochure_price,t.estimated_value,t.status,
 (aw.id is not null) awarded,aw.id award_id,aw.company_id winner_company_id,c.name winner_name,c.slug winner_slug,aw.award_date,aw.amount award_amount,aw.status award_status,
 t.source_external_id,t.source_url,t.updated_at
from public.tenders t join public.government_entities ge on ge.id=t.government_entity_id join public.activities a on a.id=t.activity_id join public.regions r on r.id=t.region_id
left join public.awards aw on aw.tender_id=t.id left join public.companies c on c.id=aw.company_id;

create or replace view public.analytics_company_awards as select c.name label,count(*)::bigint count,coalesce(sum(a.amount),0)::numeric value from public.awards a join public.companies c on c.id=a.company_id group by c.id,c.name;
create or replace view public.analytics_entity_tenders as select ge.name label,count(*)::bigint count,0::numeric value from public.tenders t join public.government_entities ge on ge.id=t.government_entity_id group by ge.id,ge.name;
create or replace view public.analytics_entity_awards as select ge.name label,count(a.id)::bigint count,coalesce(sum(a.amount),0)::numeric value from public.awards a join public.tenders t on t.id=a.tender_id join public.government_entities ge on ge.id=t.government_entity_id group by ge.id,ge.name;
create or replace view public.analytics_region_awards as select r.name label,count(a.id)::bigint count,coalesce(sum(a.amount),0)::numeric value from public.awards a join public.tenders t on t.id=a.tender_id join public.regions r on r.id=t.region_id group by r.id,r.name;
create or replace view public.analytics_activity_awards as select ac.name label,count(a.id)::bigint count,coalesce(sum(a.amount),0)::numeric value from public.awards a join public.tenders t on t.id=a.tender_id join public.activities ac on ac.id=t.activity_id group by ac.id,ac.name;
create or replace view public.analytics_monthly_awards as select to_char(date_trunc('month',award_date),'YYYY-MM') label,count(*)::bigint count,coalesce(sum(amount),0)::numeric value from public.awards group by date_trunc('month',award_date) order by date_trunc('month',award_date);

alter table public.data_sources enable row level security;
alter table public.government_entities enable row level security;
alter table public.activities enable row level security;
alter table public.regions enable row level security;
alter table public.companies enable row level security;
alter table public.tenders enable row level security;
alter table public.awards enable row level security;
alter table public.company_participations enable row level security;
alter table public.sync_logs enable row level security;
-- No public policies: application reads/writes server-side using service-role credentials.
