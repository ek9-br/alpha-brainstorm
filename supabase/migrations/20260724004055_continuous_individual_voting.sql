-- One opening starts the complete voting journey. Each participant can rate
-- every approved group at their own pace and resume from their saved progress.

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
    and s.status = 'VOTING_OPEN';

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
  on conflict (session_id, consolidated_idea_id, participant_id)
  do update set
    participant_area_id = excluded.participant_area_id,
    area_weight = excluded.area_weight,
    impact_score = excluded.impact_score,
    viability_score = excluded.viability_score,
    speed_score = excluded.speed_score,
    scalability_score = excluded.scalability_score
  returning id into out_id;

  return out_id;
end;
$$;

create or replace function public.brainstorm_get_voting_queue(
  p_session_id uuid,
  p_participant_id uuid,
  p_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1
    from public.brainstorm_participants p
    join public.brainstorm_sessions s on s.id = p.session_id
    where p.id = p_participant_id
      and p.session_id = p_session_id
      and p.anonymous_token = p_token
      and s.status in ('VOTING_OPEN', 'VOTING_WAITING')
  ) then
    raise exception 'Participante ou votação inválida';
  end if;

  select jsonb_build_object(
    'ideas',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'area_id', c.area_id,
        'area_name', a.name,
        'title', c.title,
        'description', c.description,
        'display_order', c.display_order,
        'source_count', sources.source_count,
        'source_ideas', sources.source_ideas,
        'my_ratings', case when v.id is null then null else jsonb_build_object(
          'impact', v.impact_score,
          'viability', v.viability_score,
          'speed', v.speed_score,
          'scalability', v.scalability_score
        ) end
      )
      order by c.display_order, c.created_at
    ), '[]'::jsonb)
  )
  into result
  from public.brainstorm_consolidated_ideas c
  join public.brainstorm_areas a on a.id = c.area_id
  left join public.brainstorm_votes v
    on v.consolidated_idea_id = c.id
   and v.participant_id = p_participant_id
  left join lateral (
    select
      count(i.id)::integer as source_count,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.text,
          'expected_result', i.expected_result,
          'question', r.title
        )
        order by r.display_order, i.created_at
      ) filter (where i.id is not null), '[]'::jsonb) as source_ideas
    from public.brainstorm_consolidated_idea_sources src
    join public.brainstorm_ideas i on i.id = src.idea_id
    join public.brainstorm_rounds r on r.id = i.round_id
    where src.consolidated_idea_id = c.id
  ) sources on true
  where c.session_id = p_session_id
    and c.approved;

  return coalesce(result, jsonb_build_object('ideas', '[]'::jsonb));
end;
$$;

create or replace function public.brainstorm_admin_voting_progress(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with totals as (
    select
      (select count(*)::integer from public.brainstorm_participants p where p.session_id = p_session_id) as participants,
      (select count(*)::integer from public.brainstorm_consolidated_ideas c where c.session_id = p_session_id and c.approved) as ideas,
      (select count(*)::integer from public.brainstorm_votes v where v.session_id = p_session_id) as votes
  ), participant_votes as (
    select p.id, p.primary_area_id, count(v.id)::integer as vote_count
    from public.brainstorm_participants p
    left join public.brainstorm_votes v
      on v.participant_id = p.id and v.session_id = p_session_id
    where p.session_id = p_session_id
    group by p.id, p.primary_area_id
  )
  select jsonb_build_object(
    'participant_count', t.participants,
    'connected_count', (
      select count(*) from public.brainstorm_participants p
      where p.session_id = p_session_id
        and p.last_seen_at >= now() - interval '2 minutes'
    ),
    'approved_idea_count', t.ideas,
    'total_vote_count', t.votes,
    'started_count', (select count(*) from participant_votes pv where pv.vote_count > 0),
    'completed_count', (select count(*) from participant_votes pv where t.ideas > 0 and pv.vote_count >= t.ideas),
    'completion_percentage', case
      when t.participants = 0 or t.ideas = 0 then 0
      else round(t.votes::numeric / (t.participants * t.ideas) * 100, 1)
    end,
    'idea_vote_counts', coalesce((
      select jsonb_object_agg(c.id::text, coalesce(v.vote_count, 0))
      from public.brainstorm_consolidated_ideas c
      left join lateral (
        select count(*)::integer as vote_count
        from public.brainstorm_votes x
        where x.consolidated_idea_id = c.id
      ) v on true
      where c.session_id = p_session_id and c.approved
    ), '{}'::jsonb),
    'area_progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'area_name', a.name,
        'participant_count', x.participant_count,
        'completed_count', x.completed_count,
        'vote_count', x.vote_count,
        'expected_votes', x.participant_count * t.ideas,
        'percentage', case
          when x.participant_count = 0 or t.ideas = 0 then 0
          else round(x.vote_count::numeric / (x.participant_count * t.ideas) * 100, 1)
        end
      ) order by a.display_order)
      from public.brainstorm_areas a
      join lateral (
        select
          count(*)::integer as participant_count,
          count(*) filter (where pv.vote_count >= t.ideas)::integer as completed_count,
          coalesce(sum(pv.vote_count), 0)::integer as vote_count
        from participant_votes pv
        where pv.primary_area_id = a.id
      ) x on x.participant_count > 0
    ), '[]'::jsonb)
  )
  from totals t;
$$;

revoke all on function public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) to anon;

revoke all on function public.brainstorm_get_voting_queue(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.brainstorm_get_voting_queue(uuid,uuid,uuid) to anon;

revoke all on function public.brainstorm_admin_voting_progress(uuid) from public, anon, authenticated;
grant execute on function public.brainstorm_admin_voting_progress(uuid) to service_role;

comment on function public.brainstorm_get_voting_queue(uuid,uuid,uuid) is
  'Returns the complete approved queue, anonymous sources, and only the requesting participant own saved ratings.';
