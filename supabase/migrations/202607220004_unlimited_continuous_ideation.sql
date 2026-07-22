create or replace function public.brainstorm_submit_idea(p_session_id uuid,p_round_id uuid,p_participant_id uuid,p_token uuid,p_text text,p_expected_result text default null)
returns public.brainstorm_ideas language plpgsql security definer set search_path='' as $$
declare outrow public.brainstorm_ideas;
begin
  if length(trim(p_text)) not between 2 and 500 or length(coalesce(p_expected_result,''))>500 then raise exception 'Texto inválido'; end if;
  if not exists(select 1 from public.brainstorm_sessions s join public.brainstorm_rounds r on r.id=p_round_id and r.session_id=s.id join public.brainstorm_participants p on p.id=p_participant_id and p.session_id=s.id where s.id=p_session_id and s.status in ('WAITING','IDEATION_OPEN') and p.anonymous_token=p_token) then raise exception 'Contribuição não permitida'; end if;
  insert into public.brainstorm_ideas(session_id,round_id,area_id,participant_id,text,expected_result) select p_session_id,p_round_id,r.area_id,p_participant_id,trim(p_text),nullif(trim(p_expected_result),'') from public.brainstorm_rounds r where r.id=p_round_id returning * into outrow;
  return outrow;
end $$;
revoke execute on function public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text) to anon;
