create table if not exists public.projects (
  id text primary key,
  name text not null,
  normalized_name text not null default '',
  owner_name text,
  region_name text,
  sector text,
  activity_name text,
  stage text not null default 'planning',
  estimated_value numeric,
  award_value numeric,
  confidence integer not null default 0 check (confidence between 0 and 100),
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_sources (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  source_name text not null,
  source_external_id text,
  source_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, source_url)
);

create table if not exists public.project_parties (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  role text not null,
  party_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, role, party_name)
);

create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  event_type text not null,
  title text not null,
  event_date timestamptz,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  opportunity_external_id text not null,
  opportunity_name text not null,
  status text,
  publication_date date,
  submission_deadline date,
  source_url text,
  estimated_value numeric,
  award_value numeric,
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, opportunity_external_id)
);

create index if not exists projects_stage_idx on public.projects(stage);
create index if not exists projects_region_idx on public.projects(region_name);
create index if not exists projects_sector_idx on public.projects(sector);
create index if not exists projects_last_seen_idx on public.projects(last_seen_at desc nulls last);
create index if not exists project_sources_project_idx on public.project_sources(project_id);
create index if not exists project_events_project_idx on public.project_events(project_id, event_date desc nulls last);
create index if not exists project_opportunities_project_idx on public.project_opportunities(project_id);

alter table public.projects enable row level security;
alter table public.project_sources enable row level security;
alter table public.project_parties enable row level security;
alter table public.project_events enable row level security;
alter table public.project_opportunities enable row level security;

-- Server-side access uses the Supabase service-role key. No anonymous write policies are created.
