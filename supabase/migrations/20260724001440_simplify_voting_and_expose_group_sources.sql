-- Simplify the participant vote from ten criteria to four decision-oriented
-- criteria, while keeping the legacy columns nullable for historical compatibility.

alter table public.brainstorm_votes
  alter column revenue drop not null,
  alter column margin drop not null,
  alter column savings drop not null,
  alter column ease drop not null,
  alter column speed drop not null,
  alter column scalability drop not null,
  alter column automation drop not null,
  alter column risk drop not null,
  alter column customer drop not null,
  alter column strategy drop not null,
  add column impact_score smallint not null check (impact_score between 1 and 5),
  add column viability_score smallint not null check (viability_score between 1 and 5),
  add column speed_score smallint not null check (speed_score between 1 and 5),
  add column scalability_score smallint not null check (scalability_score between 1 and 5);

create or replace function public.brainstorm_submit_vote(
  p_session_id uuid,
  p_idea_id uuid,
  p_participant_id uuid,
  p_token uuid,
  p_ratings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  out_id uuid;
  participant_area uuid;
  idea_area uuid;
  vote_weight numeric;
  impact_value integer;
  viability_value integer;
  speed_value integer;
  scalability_value integer;
begin
  impact_value := (p_ratings->>'impact')::integer;
  viability_value := (p_ratings->>'viability')::integer;
  speed_value := (p_ratings->>'speed')::integer;
  scalability_value := (p_ratings->>'scalability')::integer;

  if impact_value is null
    or viability_value is null
    or speed_value is null
    or scalability_value is null
    or impact_value not between 1 and 5
    or viability_value not between 1 and 5
    or speed_value not between 1 and 5
    or scalability_value not between 1 and 5 then
    raise exception 'Todas as avaliações devem estar entre 1 e 5';
  end if;

  select p.primary_area_id, c.area_id
    into participant_area, idea_area
  from public.brainstorm_participants p
  join public.brainstorm_sessions s
    on s.id = p_session_id
   and p.session_id = s.id
  join public.brainstorm_consolidated_ideas c
    on c.id = p_idea_id
   and c.session_id = s.id
  where p.id = p_participant_id
    and p.anonymous_token = p_token
    and c.approved
    and s.status = 'VOTING_OPEN'
    and s.current_consolidated_idea_id = c.id;

  if participant_area is null then
    raise exception 'Voto não permitido';
  end if;

  vote_weight := case
    when participant_area = idea_area
      and not exists (
        select 1 from public.brainstorm_areas a
        where a.id = idea_area and a.slug in ('diretoria', 'outro')
      )
    then 1.30
    else 1
  end;

  insert into public.brainstorm_votes(
    session_id, consolidated_idea_id, participant_id, participant_area_id,
    area_weight, impact_score, viability_score, speed_score, scalability_score
  ) values (
    p_session_id, p_idea_id, p_participant_id, participant_area,
    vote_weight, impact_value, viability_value, speed_value, scalability_value
  )
  returning id into out_id;

  return out_id;
end;
$$;

-- A participant may see the original anonymous contributions only for the
-- approved idea currently being presented. Participant identifiers stay private.
create or replace function public.brainstorm_get_current_voting_idea(
  p_session_id uuid,
  p_participant_id uuid,
  p_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'area_id', c.area_id,
    'area_name', a.name,
    'title', c.title,
    'description', c.description,
    'display_order', c.display_order,
    'source_count', count(i.id),
    'source_ideas', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.text,
          'expected_result', i.expected_result,
          'question', r.title
        )
        order by r.display_order, i.created_at
      ) filter (where i.id is not null),
      '[]'::jsonb
    )
  )
  from public.brainstorm_participants p
  join public.brainstorm_sessions s
    on s.id = p_session_id
   and p.session_id = s.id
   and p.id = p_participant_id
   and p.anonymous_token = p_token
  join public.brainstorm_consolidated_ideas c
    on c.id = s.current_consolidated_idea_id
   and c.session_id = s.id
   and c.approved
  join public.brainstorm_areas a on a.id = c.area_id
  left join public.brainstorm_consolidated_idea_sources src
    on src.consolidated_idea_id = c.id
  left join public.brainstorm_ideas i on i.id = src.idea_id
  left join public.brainstorm_rounds r on r.id = i.round_id
  where s.status in ('VOTING_OPEN', 'VOTING_WAITING')
  group by c.id, a.name;
$$;

drop function if exists public.brainstorm_get_published_results(text);

create function public.brainstorm_get_published_results(p_session_code text)
returns table(
  id uuid,
  area_id uuid,
  area_name text,
  title text,
  description text,
  display_order integer,
  vote_count integer,
  contribution_count integer,
  impact numeric,
  viability numeric,
  speed numeric,
  scalability numeric,
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
      v.impact,
      v.viability,
      v.speed,
      v.scalability,
      round((v.impact + v.viability + v.speed + v.scalability) / 4, 2)
        as overall_score
    from eligible e
    left join lateral (
      select count(*)::integer as contribution_count
      from public.brainstorm_consolidated_idea_sources cis
      where cis.consolidated_idea_id = e.id
    ) src on true
    left join lateral (
      select
        count(*)::integer as vote_count,
        round(sum(x.impact_score*x.area_weight)/nullif(sum(x.area_weight),0),2) as impact,
        round(sum(x.viability_score*x.area_weight)/nullif(sum(x.area_weight),0),2) as viability,
        round(sum(x.speed_score*x.area_weight)/nullif(sum(x.area_weight),0),2) as speed,
        round(sum(x.scalability_score*x.area_weight)/nullif(sum(x.area_weight),0),2) as scalability
      from public.brainstorm_votes x
      where x.consolidated_idea_id = e.id
    ) v on true
  )
  select
    s.id, s.area_id, s.area_name, s.title, s.description, s.display_order,
    s.vote_count, s.contribution_count,
    s.impact, s.viability, s.speed, s.scalability, s.overall_score,
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

revoke all on function public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) to anon;

revoke all on function public.brainstorm_get_current_voting_idea(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.brainstorm_get_current_voting_idea(uuid,uuid,uuid) to anon;

revoke all on function public.brainstorm_get_published_results(text) from public, anon, authenticated;
grant execute on function public.brainstorm_get_published_results(text) to anon;

comment on function public.brainstorm_get_current_voting_idea(uuid,uuid,uuid) is
  'Returns the current approved group and its anonymous source contributions only to a valid participant.';
comment on function public.brainstorm_get_published_results(text) is
  'Returns four-criterion aggregate results only after publication; never exposes individual votes.';
