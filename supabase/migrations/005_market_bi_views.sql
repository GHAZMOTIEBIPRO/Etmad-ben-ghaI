create or replace view public.market_metrics_view as
select
  count(*)::bigint as total_projects,
  coalesce(sum(coalesce(estimated_value, award_value, 0)), 0)::numeric as known_project_value,
  count(*) filter (where stage in ('planning', 'design', 'qualification', 'tendering'))::bigint as pipeline_projects,
  count(*) filter (where first_seen_at >= now() - interval '7 days')::bigint as new_last_7_days,
  count(*) filter (where last_seen_at >= now() - interval '30 days')::bigint as updated_last_30_days,
  (select count(*) from public.project_opportunities where status = 'open')::bigint as open_opportunities,
  (select count(*) from public.project_opportunities where status = 'awarded' or award_value is not null)::bigint as awarded_opportunities
from public.projects;

create or replace view public.market_stage_summary as
select
  stage as key,
  count(*)::bigint as count,
  coalesce(sum(coalesce(estimated_value, award_value, 0)), 0)::numeric as value
from public.projects
group by stage;

create or replace view public.market_region_summary as
select
  coalesce(nullif(region_name, ''), 'غير محدد') as key,
  count(*)::bigint as count,
  coalesce(sum(coalesce(estimated_value, award_value, 0)), 0)::numeric as value
from public.projects
group by coalesce(nullif(region_name, ''), 'غير محدد');

create or replace view public.market_sector_summary as
select
  coalesce(nullif(sector, ''), 'غير محدد') as key,
  count(*)::bigint as count,
  coalesce(sum(coalesce(estimated_value, award_value, 0)), 0)::numeric as value
from public.projects
group by coalesce(nullif(sector, ''), 'غير محدد');

create index if not exists project_opportunities_status_idx on public.project_opportunities(status);
create index if not exists project_opportunities_deadline_idx on public.project_opportunities(submission_deadline);
