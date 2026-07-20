alter table public.projects
  add column if not exists fit_score_breakdown jsonb not null default '[]'::jsonb;

create index if not exists projects_fit_score_desc_idx
  on public.projects(fit_score desc, last_seen_at desc nulls last);

create or replace function public.calculate_project_relevance_score(
  p_region text,
  p_sector text,
  p_activity text,
  p_stage text,
  p_estimated_value numeric,
  p_award_value numeric
)
returns integer
language plpgsql
immutable
parallel safe
as $$
declare
  score integer := 0;
  haystack text := lower(coalesce(p_sector, '') || ' ' || coalesce(p_activity, ''));
  known_value numeric := coalesce(p_estimated_value, p_award_value, 0);
begin
  -- Geography: Riyadh, Eastern Province, Qassim are the primary operating priorities.
  if coalesce(p_region, '') ~* '(الرياض|riyadh)' then
    score := score + 25;
  elsif coalesce(p_region, '') ~* '(المنطقة الشرقية|الشرقية|الدمام|الخبر|الظهران|الأحساء|eastern|dammam|khobar|dhahran|ahsa)' then
    score := score + 22;
  elsif coalesce(p_region, '') ~* '(القصيم|بريدة|عنيزة|الرس|qassim|buraydah|unaizah)' then
    score := score + 20;
  else
    score := score + 6;
  end if;

  -- Activity / sector fit for construction and infrastructure contractors.
  if haystack ~* '(مقاولات|إنشاء|انشاء|بناء|مباني|مدني|بنية تحتية|طرق|جسور|أنفاق|مرافق|صيانة|تشغيل|تأهيل|ترميم|تشطيب|fit.?out|mep|فندق|ضيافة|تجاري|تجزئة|retail|industrial|صناعي|مستودع|warehouse|سكني|فلل|mixed.?use|متعدد الاستخدامات|landscape|تنسيق مواقع|utilities|construction|infrastructure|building)' then
    score := score + 30;
  else
    score := score + 7;
  end if;

  -- Direct execution value band. Unknown value receives a neutral score.
  if known_value <= 0 then
    score := score + 10;
  elsif known_value between 500000 and 20000000 then
    score := score + 25;
  elsif known_value < 500000 then
    score := score + 16;
  elsif known_value <= 35000000 then
    score := score + 17;
  elsif known_value <= 75000000 then
    score := score + 9;
  else
    score := score + 3;
  end if;

  -- Commercial timing by project stage.
  score := score + case coalesce(p_stage, '')
    when 'tendering' then 20
    when 'qualification' then 16
    when 'design' then 12
    when 'planning' then 10
    when 'construction' then 7
    when 'operation' then 7
    when 'awarded' then 4
    else 2
  end;

  return greatest(0, least(100, score));
end;
$$;

comment on function public.calculate_project_relevance_score(text, text, text, text, numeric, numeric)
is 'Explainable 0-100 contractor relevance score prioritizing Riyadh, Eastern Province and Qassim, construction/infrastructure fit, project value and stage.';

-- Recalculate only rows that do not already have a meaningful score. The TypeScript
-- scoring engine remains authoritative because it also includes tender deadlines.
update public.projects
set fit_score = public.calculate_project_relevance_score(
  region_name,
  sector,
  activity_name,
  stage,
  estimated_value,
  award_value
)
where coalesce(fit_score, 0) = 0;
