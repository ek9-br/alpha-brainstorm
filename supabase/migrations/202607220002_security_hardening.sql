drop policy if exists participant_restore on public.brainstorm_participants;
drop policy if exists own_ideas_read on public.brainstorm_ideas;
revoke select, insert, update, delete on table public.brainstorm_participants, public.brainstorm_ideas, public.brainstorm_votes, public.brainstorm_consolidated_idea_sources from anon, authenticated;
revoke insert, update, delete on table public.brainstorm_areas, public.brainstorm_sessions, public.brainstorm_participants, public.brainstorm_rounds, public.brainstorm_ideas, public.brainstorm_consolidated_ideas, public.brainstorm_consolidated_idea_sources, public.brainstorm_votes from anon, authenticated;

create or replace function public.brainstorm_restore_participant(p_session_code text,p_anonymous_token uuid)
returns setof public.brainstorm_participants language plpgsql security definer set search_path='' as $$
begin return query update public.brainstorm_participants p set last_seen_at=now() from public.brainstorm_sessions s where p.session_id=s.id and s.code=upper(p_session_code) and p.anonymous_token=p_anonymous_token returning p.*; end $$;

create or replace function public.brainstorm_get_my_ideas(p_session_id uuid,p_participant_id uuid,p_token uuid,p_round_id uuid default null)
returns setof public.brainstorm_ideas language sql security definer set search_path='' stable as $$
select i.* from public.brainstorm_ideas i join public.brainstorm_participants p on p.id=i.participant_id where p.id=p_participant_id and p.session_id=p_session_id and p.anonymous_token=p_token and i.session_id=p_session_id and (p_round_id is null or i.round_id=p_round_id) order by i.created_at;
$$;

create or replace function public.brainstorm_get_participant_state(p_session_id uuid,p_participant_id uuid,p_token uuid)
returns jsonb language sql security definer set search_path='' stable as $$
select jsonb_build_object('participant_id',p.id,'primary_area_id',p.primary_area_id,'current_round_idea_count',(select count(*) from public.brainstorm_ideas i where i.participant_id=p.id and i.round_id=s.current_round_id),'has_voted_current_idea',exists(select 1 from public.brainstorm_votes v where v.participant_id=p.id and v.consolidated_idea_id=s.current_consolidated_idea_id)) from public.brainstorm_participants p join public.brainstorm_sessions s on s.id=p.session_id where p.id=p_participant_id and p.session_id=p_session_id and p.anonymous_token=p_token;
$$;

create or replace function public.brainstorm_change_participant_area(p_session_id uuid,p_participant_id uuid,p_token uuid,p_area_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin if not exists(select 1 from public.brainstorm_sessions s join public.brainstorm_participants p on p.session_id=s.id join public.brainstorm_areas a on a.id=p_area_id and a.active where s.id=p_session_id and s.status='WAITING' and p.id=p_participant_id and p.anonymous_token=p_token) then raise exception 'Troca de setor não permitida'; end if; update public.brainstorm_participants set primary_area_id=p_area_id,last_seen_at=now() where id=p_participant_id and session_id=p_session_id and anonymous_token=p_token; return p_area_id; end $$;

create or replace function public.brainstorm_get_public_session_counts(p_session_id uuid)
returns jsonb language sql security definer set search_path='' stable as $$
select jsonb_build_object('participants',(select count(*) from public.brainstorm_participants where session_id=p_session_id),'ideas',(select count(*) from public.brainstorm_ideas where session_id=p_session_id),'current_round_ideas',(select count(*) from public.brainstorm_ideas i join public.brainstorm_sessions s on s.id=i.session_id where s.id=p_session_id and i.round_id=s.current_round_id)) where exists(select 1 from public.brainstorm_sessions where id=p_session_id);
$$;

create table public.brainstorm_admin_sessions(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.brainstorm_sessions on delete cascade,token_hash text not null unique,expires_at timestamptz not null,created_at timestamptz not null default now(),last_used_at timestamptz not null default now(),revoked_at timestamptz);
create index brainstorm_admin_sessions_lookup_idx on public.brainstorm_admin_sessions(token_hash,expires_at);
create table public.brainstorm_admin_login_attempts(id bigint generated always as identity primary key,session_id uuid references public.brainstorm_sessions on delete cascade,client_hash text not null,success boolean not null,created_at timestamptz not null default now());
create index brainstorm_admin_attempts_rate_idx on public.brainstorm_admin_login_attempts(client_hash,created_at desc);
create table public.brainstorm_admin_audit_log(id bigint generated always as identity primary key,session_id uuid not null references public.brainstorm_sessions on delete cascade,action text not null check(length(action) between 1 and 80),payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index brainstorm_admin_audit_session_idx on public.brainstorm_admin_audit_log(session_id,created_at desc);
alter table public.brainstorm_admin_sessions enable row level security; alter table public.brainstorm_admin_login_attempts enable row level security; alter table public.brainstorm_admin_audit_log enable row level security;
revoke all on public.brainstorm_admin_sessions,public.brainstorm_admin_login_attempts,public.brainstorm_admin_audit_log from anon,authenticated,public;
grant all on public.brainstorm_admin_sessions,public.brainstorm_admin_login_attempts,public.brainstorm_admin_audit_log to service_role;
grant usage,select on sequence public.brainstorm_admin_login_attempts_id_seq,public.brainstorm_admin_audit_log_id_seq to service_role;

revoke execute on function public.brainstorm_restore_participant(text,uuid),public.brainstorm_get_my_ideas(uuid,uuid,uuid,uuid),public.brainstorm_get_participant_state(uuid,uuid,uuid),public.brainstorm_change_participant_area(uuid,uuid,uuid,uuid),public.brainstorm_get_public_session_counts(uuid) from public,anon,authenticated;
grant execute on function public.brainstorm_restore_participant(text,uuid),public.brainstorm_get_my_ideas(uuid,uuid,uuid,uuid),public.brainstorm_get_participant_state(uuid,uuid,uuid),public.brainstorm_change_participant_area(uuid,uuid,uuid,uuid),public.brainstorm_get_public_session_counts(uuid) to anon;
revoke execute on function public.brainstorm_verify_admin_pin(text,text) from public,anon,authenticated; grant execute on function public.brainstorm_verify_admin_pin(text,text) to service_role;
revoke execute on function public.brainstorm_join_session(text,uuid,uuid),public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text),public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.brainstorm_join_session(text,uuid,uuid),public.brainstorm_submit_idea(uuid,uuid,uuid,uuid,text,text),public.brainstorm_submit_vote(uuid,uuid,uuid,uuid,jsonb) to anon;

-- This application has no signed-in participant role. Keep that unused surface closed.
revoke all on table public.brainstorm_areas,public.brainstorm_sessions,public.brainstorm_participants,public.brainstorm_rounds,public.brainstorm_ideas,public.brainstorm_consolidated_ideas,public.brainstorm_consolidated_idea_sources,public.brainstorm_votes,public.brainstorm_published_results from authenticated;
revoke insert,update,delete,truncate,references,trigger on table public.brainstorm_published_results from anon;
grant select on table public.brainstorm_published_results to anon;
