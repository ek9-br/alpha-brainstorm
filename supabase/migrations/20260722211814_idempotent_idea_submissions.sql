alter table public.brainstorm_ideas add column client_submission_id uuid;
create unique index brainstorm_ideas_idempotency_idx
  on public.brainstorm_ideas(participant_id, client_submission_id)
  where client_submission_id is not null;

create or replace function public.brainstorm_submit_idea(
  p_session_id uuid,
  p_round_id uuid,
  p_participant_id uuid,
  p_token uuid,
  p_text text,
  p_expected_result text,
  p_client_submission_id uuid
)
returns public.brainstorm_ideas
language plpgsql
security definer
set search_path = ''
as $$
declare outrow public.brainstorm_ideas;
begin
  if p_client_submission_id is null then raise exception 'Identificador do envio obrigatório'; end if;
  if length(trim(p_text)) not between 2 and 500 or length(coalesce(p_expected_result,'')) > 500 then raise exception 'Texto inválido'; end if;
  if not exists(
    select 1 from public.brainstorm_sessions s
    join public.brainstorm_rounds r on r.id=p_round_id and r.session_id=s.id
    join public.brainstorm_participants p on p.id=p_participant_id and p.session_id=s.id
    where s.id=p_session_id and s.status in ('WAITING','IDEATION_OPEN') and p.anonymous_token=p_token
  ) then raise exception 'Contribuição não permitida'; end if;

  select * into outrow from public.brainstorm_ideas
  where participant_id=p_participant_id and client_submission_id=p_client_submission_id;
  if outrow.id is not null then return outrow; end if;

  insert into public.brainstorm_ideas(session_id,round_id,area_id,participant_id,text,expected_result,client_submission_id)
  select p_session_id,p_round_id,r.area_id,p_participant_id,trim(p_text),nullif(trim(p_expected_result),''),p_client_submission_id
  from public.brainstorm_rounds r where r.id=p_round_id
  on conflict (participant_id,client_submission_id) where client_submission_id is not null do nothing
  returning * into outrow;

  if outrow.id is null then
    select * into outrow from public.brainstorm_ideas
    where participant_id=p_participant_id and client_submission_id=p_client_submission_id;
  end if;
  return outrow;
end;
$$;

revoke all on function public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text,uuid) from public;
grant execute on function public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text,uuid) to anon, authenticated;
