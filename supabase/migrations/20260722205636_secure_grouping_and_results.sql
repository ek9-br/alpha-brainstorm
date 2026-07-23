-- Integrity and safe read model for grouping, voting and published results.

alter table public.brainstorm_consolidated_ideas
  add constraint brainstorm_consolidated_title_not_blank
  check (length(trim(title)) between 2 and 160),
  add constraint brainstorm_consolidated_description_length
  check (length(description) <= 800),
  add constraint brainstorm_consolidated_display_order_nonnegative
  check (display_order >= 0);

create index if not exists brainstorm_consolidated_order_idx
  on public.brainstorm_consolidated_ideas(session_id, display_order, created_at);
create index if not exists brainstorm_sources_idea_idx
  on public.brainstorm_consolidated_idea_sources(idea_id);
create index if not exists brainstorm_votes_session_idea_idx
  on public.brainstorm_votes(session_id, consolidated_idea_id);

create or replace function public.brainstorm_touch_consolidated_idea()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.title := trim(new.title);
  new.description := trim(new.description);
  return new;
end;
$$;

drop trigger if exists brainstorm_touch_consolidated_idea
  on public.brainstorm_consolidated_ideas;
create trigger brainstorm_touch_consolidated_idea
before insert or update on public.brainstorm_consolidated_ideas
for each row execute function public.brainstorm_touch_consolidated_idea();

create or replace function public.brainstorm_guard_group_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_session_id uuid;
  target_status public.brainstorm_session_status;
begin
  target_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  select s.status into target_status
  from public.brainstorm_sessions s
  where s.id = target_session_id;

  if target_status in ('RESULTS', 'FINISHED') then
    raise exception 'Ideias não podem ser alteradas após a publicação dos resultados';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists brainstorm_guard_group_mutation
  on public.brainstorm_consolidated_ideas;
create trigger brainstorm_guard_group_mutation
before insert or update or delete on public.brainstorm_consolidated_ideas
for each row execute function public.brainstorm_guard_group_mutation();

create or replace function public.brainstorm_guard_source_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  group_id uuid;
  group_session_id uuid;
  group_area_id uuid;
  source_session_id uuid;
  source_area_id uuid;
  target_status public.brainstorm_session_status;
begin
  group_id := case when tg_op = 'DELETE' then old.consolidated_idea_id else new.consolidated_idea_id end;

  select c.session_id, c.area_id, s.status
    into group_session_id, group_area_id, target_status
  from public.brainstorm_consolidated_ideas c
  join public.brainstorm_sessions s on s.id = c.session_id
  where c.id = group_id;

  if target_status in ('RESULTS', 'FINISHED') then
    raise exception 'Agrupamentos não podem ser alterados após a publicação dos resultados';
  end if;

  if tg_op <> 'DELETE' then
    select i.session_id, i.area_id into source_session_id, source_area_id
    from public.brainstorm_ideas i
    where i.id = new.idea_id;

    if source_session_id is distinct from group_session_id
      or source_area_id is distinct from group_area_id then
      raise exception 'A contribuição e o grupo devem pertencer à mesma sessão e ao mesmo setor';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists brainstorm_guard_source_mutation
  on public.brainstorm_consolidated_idea_sources;
create trigger brainstorm_guard_source_mutation
before insert or update or delete on public.brainstorm_consolidated_idea_sources
for each row execute function public.brainstorm_guard_source_mutation();

-- Results are exposed only after publication and never include individual votes.
drop view if exists public.brainstorm_published_results;

create or replace function public.brainstorm_get_published_results(p_session_code text)
returns table(
  id uuid,
  area_id uuid,
  area_name text,
  title text,
  description text,
  display_order integer,
  vote_count integer,
  contribution_count integer,
  revenue numeric,
  margin numeric,
  savings numeric,
  ease numeric,
  speed numeric,
  scalability numeric,
  automation numeric,
  risk numeric,
  customer numeric,
  strategy numeric,
  impact numeric,
  viability numeric,
  overall_score numeric,
  classification text
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select c.*, a.name as area_name
    from public.brainstorm_consolidated_ideas c
    join public.brainstorm_sessions s on s.id = c.session_id
    join public.brainstorm_areas a on a.id = c.area_id
    where s.code = upper(trim(p_session_code))
      and s.status in ('RESULTS', 'FINISHED')
      and c.approved
  ), scored as (
    select
      e.*,
      coalesce(src.contribution_count, 0)::integer as contribution_count,
      coalesce(v.vote_count, 0)::integer as vote_count,
      v.revenue, v.margin, v.savings, v.ease, v.speed,
      v.scalability, v.automation, v.risk, v.customer, v.strategy,
      round((v.revenue + v.margin + v.savings + v.customer + v.strategy) / 5, 2) as impact,
      round((v.ease + v.speed + v.scalability + v.automation + v.risk) / 5, 2) as viability,
      round((v.revenue*5 + v.margin*5 + v.savings*4 + v.ease*3 + v.speed*4
        + v.scalability*5 + v.automation*4 + v.risk*3 + v.customer*4 + v.strategy*5) / 42, 2) as overall_score
    from eligible e
    left join lateral (
      select count(*)::integer as contribution_count
      from public.brainstorm_consolidated_idea_sources cis
      where cis.consolidated_idea_id = e.id
    ) src on true
    left join lateral (
      select
        count(*)::integer as vote_count,
        round(sum(x.revenue*x.area_weight)/nullif(sum(x.area_weight),0),2) as revenue,
        round(sum(x.margin*x.area_weight)/nullif(sum(x.area_weight),0),2) as margin,
        round(sum(x.savings*x.area_weight)/nullif(sum(x.area_weight),0),2) as savings,
        round(sum(x.ease*x.area_weight)/nullif(sum(x.area_weight),0),2) as ease,
        round(sum(x.speed*x.area_weight)/nullif(sum(x.area_weight),0),2) as speed,
        round(sum(x.scalability*x.area_weight)/nullif(sum(x.area_weight),0),2) as scalability,
        round(sum(x.automation*x.area_weight)/nullif(sum(x.area_weight),0),2) as automation,
        round(sum(x.risk*x.area_weight)/nullif(sum(x.area_weight),0),2) as risk,
        round(sum(x.customer*x.area_weight)/nullif(sum(x.area_weight),0),2) as customer,
        round(sum(x.strategy*x.area_weight)/nullif(sum(x.area_weight),0),2) as strategy
      from public.brainstorm_votes x
      where x.consolidated_idea_id = e.id
    ) v on true
  )
  select
    s.id, s.area_id, s.area_name, s.title, s.description, s.display_order,
    s.vote_count, s.contribution_count,
    s.revenue, s.margin, s.savings, s.ease, s.speed,
    s.scalability, s.automation, s.risk, s.customer, s.strategy,
    s.impact, s.viability, s.overall_score,
    case
      when s.vote_count = 0 then 'Sem votos'
      when s.impact >= 3.5 and s.viability >= 3.5 then 'Quick Win'
      when s.impact >= 3.5 then 'Aposta Estratégica'
      when s.viability >= 3.5 then 'Melhoria Incremental'
      else 'Backlog'
    end as classification
  from scored s
  order by s.overall_score desc nulls last, s.display_order, s.created_at;
$$;

revoke all on function public.brainstorm_get_published_results(text) from public;
grant execute on function public.brainstorm_get_published_results(text) to anon, authenticated;

comment on function public.brainstorm_get_published_results(text) is
  'Returns aggregate results only after the session is published; never exposes individual votes.';
