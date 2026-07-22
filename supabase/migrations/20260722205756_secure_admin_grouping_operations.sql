-- Transactional administrative operations. They are callable only with service_role;
-- the Edge Function remains responsible for validating the short-lived admin token.

create or replace function public.brainstorm_admin_create_group(
  p_session_id uuid,
  p_area_id uuid,
  p_title text,
  p_description text default '',
  p_idea_ids uuid[] default array[]::uuid[]
)
returns public.brainstorm_consolidated_ideas
language plpgsql
set search_path = ''
as $$
declare
  outrow public.brainstorm_consolidated_ideas;
  next_order integer;
  expected_count integer;
  valid_count integer;
begin
  if not exists (
    select 1 from public.brainstorm_sessions s
    where s.id = p_session_id and s.status in ('AI_GROUPING', 'GROUP_REVIEW')
  ) then raise exception 'A sessão não está disponível para agrupamento'; end if;

  if not exists (
    select 1 from public.brainstorm_areas a where a.id = p_area_id and a.active
  ) then raise exception 'Setor inválido'; end if;

  select count(distinct x) into expected_count from unnest(coalesce(p_idea_ids, array[]::uuid[])) x;
  select count(*) into valid_count
  from public.brainstorm_ideas i
  where i.id = any(coalesce(p_idea_ids, array[]::uuid[]))
    and i.session_id = p_session_id and i.area_id = p_area_id;
  if valid_count <> expected_count then
    raise exception 'Uma ou mais contribuições não pertencem à sessão e ao setor escolhidos';
  end if;

  select coalesce(max(c.display_order), -1) + 1 into next_order
  from public.brainstorm_consolidated_ideas c where c.session_id = p_session_id;

  insert into public.brainstorm_consolidated_ideas(
    session_id, area_id, title, description, grouping_method,
    grouping_confidence, approved, display_order
  ) values (
    p_session_id, p_area_id, trim(p_title), trim(coalesce(p_description,'')),
    'manual', null, false, next_order
  ) returning * into outrow;

  insert into public.brainstorm_consolidated_idea_sources(consolidated_idea_id, idea_id)
  select outrow.id, x
  from (select distinct unnest(coalesce(p_idea_ids, array[]::uuid[])) as x) chosen;

  return outrow;
end;
$$;

create or replace function public.brainstorm_admin_update_group(
  p_group_id uuid,
  p_title text,
  p_description text,
  p_approved boolean
)
returns public.brainstorm_consolidated_ideas
language plpgsql
set search_path = ''
as $$
declare outrow public.brainstorm_consolidated_ideas;
begin
  if not exists (
    select 1
    from public.brainstorm_consolidated_ideas c
    join public.brainstorm_sessions s on s.id = c.session_id
    where c.id = p_group_id and s.status in ('AI_GROUPING', 'GROUP_REVIEW')
  ) then raise exception 'Ideia consolidada indisponível para edição'; end if;

  update public.brainstorm_consolidated_ideas
  set title = p_title, description = coalesce(p_description,''), approved = p_approved
  where id = p_group_id
  returning * into outrow;
  return outrow;
end;
$$;

create or replace function public.brainstorm_admin_set_group_sources(
  p_group_id uuid,
  p_idea_ids uuid[]
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  target_session_id uuid;
  target_area_id uuid;
  expected_count integer;
  valid_count integer;
begin
  select c.session_id, c.area_id into target_session_id, target_area_id
  from public.brainstorm_consolidated_ideas c
  join public.brainstorm_sessions s on s.id = c.session_id
  where c.id = p_group_id and s.status in ('AI_GROUPING', 'GROUP_REVIEW');
  if target_session_id is null then raise exception 'Ideia consolidada indisponível para edição'; end if;

  select count(distinct x) into expected_count from unnest(coalesce(p_idea_ids, array[]::uuid[])) x;
  select count(*) into valid_count
  from public.brainstorm_ideas i
  where i.id = any(coalesce(p_idea_ids, array[]::uuid[]))
    and i.session_id = target_session_id and i.area_id = target_area_id;
  if valid_count <> expected_count then
    raise exception 'Uma ou mais contribuições não pertencem à sessão e ao setor do grupo';
  end if;

  delete from public.brainstorm_consolidated_idea_sources where consolidated_idea_id = p_group_id;
  insert into public.brainstorm_consolidated_idea_sources(consolidated_idea_id, idea_id)
  select p_group_id, x
  from (select distinct unnest(coalesce(p_idea_ids, array[]::uuid[])) as x) chosen;
  return expected_count;
end;
$$;

create or replace function public.brainstorm_admin_delete_group(p_group_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.brainstorm_consolidated_ideas c
    join public.brainstorm_sessions s on s.id = c.session_id
    where c.id = p_group_id and s.status in ('AI_GROUPING', 'GROUP_REVIEW')
  ) then raise exception 'Ideia consolidada indisponível para exclusão'; end if;
  delete from public.brainstorm_consolidated_ideas where id = p_group_id;
  return found;
end;
$$;

create or replace function public.brainstorm_admin_reorder_groups(
  p_session_id uuid,
  p_group_ids uuid[]
)
returns integer
language plpgsql
set search_path = ''
as $$
declare expected_count integer; valid_count integer;
begin
  if not exists (
    select 1 from public.brainstorm_sessions s
    where s.id = p_session_id and s.status in ('AI_GROUPING', 'GROUP_REVIEW')
  ) then raise exception 'A ordem não pode ser alterada nesta etapa'; end if;

  select count(distinct x) into expected_count from unnest(coalesce(p_group_ids, array[]::uuid[])) x;
  select count(*) into valid_count from public.brainstorm_consolidated_ideas c
  where c.session_id = p_session_id and c.id = any(coalesce(p_group_ids, array[]::uuid[]));
  if valid_count <> expected_count then raise exception 'Lista de ideias inválida'; end if;

  update public.brainstorm_consolidated_ideas c
  set display_order = ordered.position - 1
  from unnest(coalesce(p_group_ids, array[]::uuid[])) with ordinality ordered(id, position)
  where c.id = ordered.id and c.session_id = p_session_id;
  return expected_count;
end;
$$;

create or replace function public.brainstorm_admin_select_current_idea(
  p_session_id uuid,
  p_group_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.brainstorm_consolidated_ideas c
    join public.brainstorm_sessions s on s.id = c.session_id
    where c.id = p_group_id and c.session_id = p_session_id and c.approved
      and s.status in ('GROUP_REVIEW', 'VOTING_OPEN', 'VOTING_WAITING')
  ) then raise exception 'Selecione uma ideia aprovada desta sessão'; end if;

  update public.brainstorm_sessions
  set current_consolidated_idea_id = p_group_id, updated_at = now()
  where id = p_session_id;
  return p_group_id;
end;
$$;

create or replace function public.brainstorm_admin_voting_progress(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'participant_count', (select count(*) from public.brainstorm_participants p where p.session_id = p_session_id),
    'current_idea_id', s.current_consolidated_idea_id,
    'current_vote_count', (
      select count(*) from public.brainstorm_votes v
      where v.session_id = p_session_id
        and v.consolidated_idea_id = s.current_consolidated_idea_id
    ),
    'approved_idea_count', (
      select count(*) from public.brainstorm_consolidated_ideas c
      where c.session_id = p_session_id and c.approved
    )
  )
  from public.brainstorm_sessions s where s.id = p_session_id;
$$;

revoke all on function public.brainstorm_admin_create_group(uuid,uuid,text,text,uuid[]) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_update_group(uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_set_group_sources(uuid,uuid[]) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_delete_group(uuid) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_reorder_groups(uuid,uuid[]) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_select_current_idea(uuid,uuid) from public, anon, authenticated;
revoke all on function public.brainstorm_admin_voting_progress(uuid) from public, anon, authenticated;

grant execute on function public.brainstorm_admin_create_group(uuid,uuid,text,text,uuid[]) to service_role;
grant execute on function public.brainstorm_admin_update_group(uuid,text,text,boolean) to service_role;
grant execute on function public.brainstorm_admin_set_group_sources(uuid,uuid[]) to service_role;
grant execute on function public.brainstorm_admin_delete_group(uuid) to service_role;
grant execute on function public.brainstorm_admin_reorder_groups(uuid,uuid[]) to service_role;
grant execute on function public.brainstorm_admin_select_current_idea(uuid,uuid) to service_role;
grant execute on function public.brainstorm_admin_voting_progress(uuid) to service_role;
