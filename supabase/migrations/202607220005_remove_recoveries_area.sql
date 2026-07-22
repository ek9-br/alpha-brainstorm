delete from public.brainstorm_rounds
where area_id=(select id from public.brainstorm_areas where slug='recuperacoes')
  and not exists(select 1 from public.brainstorm_ideas where area_id=(select id from public.brainstorm_areas where slug='recuperacoes'));
delete from public.brainstorm_areas where slug='recuperacoes'
  and not exists(select 1 from public.brainstorm_participants where primary_area_id=brainstorm_areas.id)
  and not exists(select 1 from public.brainstorm_ideas where area_id=brainstorm_areas.id)
  and not exists(select 1 from public.brainstorm_consolidated_ideas where area_id=brainstorm_areas.id);
