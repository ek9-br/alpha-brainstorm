create or replace function public.brainstorm_participant_heartbeat(
  p_session_id uuid,
  p_participant_id uuid,
  p_token uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare touched_at timestamptz := now();
begin
  update public.brainstorm_participants
  set last_seen_at = touched_at
  where id = p_participant_id
    and session_id = p_session_id
    and anonymous_token = p_token;
  if not found then raise exception 'Participante inválido'; end if;
  return touched_at;
end;
$$;

revoke all on function public.brainstorm_participant_heartbeat(uuid,uuid,uuid) from public;
grant execute on function public.brainstorm_participant_heartbeat(uuid,uuid,uuid) to anon, authenticated;

create or replace function public.brainstorm_admin_voting_progress(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'participant_count', (select count(*) from public.brainstorm_participants p where p.session_id = p_session_id),
    'connected_count', (select count(*) from public.brainstorm_participants p where p.session_id = p_session_id and p.last_seen_at >= now() - interval '2 minutes'),
    'current_idea_id', s.current_consolidated_idea_id,
    'current_vote_count', (
      select count(*) from public.brainstorm_votes v
      where v.session_id = p_session_id and v.consolidated_idea_id = s.current_consolidated_idea_id
    ),
    'approved_idea_count', (
      select count(*) from public.brainstorm_consolidated_ideas c
      where c.session_id = p_session_id and c.approved
    ),
    'idea_vote_counts', coalesce((
      select jsonb_object_agg(c.id::text, coalesce(v.vote_count, 0))
      from public.brainstorm_consolidated_ideas c
      left join lateral (
        select count(*)::integer as vote_count
        from public.brainstorm_votes x where x.consolidated_idea_id = c.id
      ) v on true
      where c.session_id = p_session_id and c.approved
    ), '{}'::jsonb)
  )
  from public.brainstorm_sessions s where s.id = p_session_id;
$$;

revoke all on function public.brainstorm_admin_voting_progress(uuid) from public, anon, authenticated;
grant execute on function public.brainstorm_admin_voting_progress(uuid) to service_role;
