alter table public.brainstorm_rounds
  add column pillar text check(pillar is null or pillar in ('Crescimento','Redução de custos','Otimização','Pergunta aberta')),
  add column topic varchar(120),
  add column context_text varchar(2000),
  add column kpis text[] not null default '{}';

update public.brainstorm_rounds set
  pillar=case
    when supporting_text like 'Pilar: Crescimento%' then 'Crescimento'
    when supporting_text like 'Pilar: Redução de custos%' then 'Redução de custos'
    when supporting_text like 'Pilar: Otimização%' then 'Otimização'
    when supporting_text like 'Pilar: Pergunta aberta%' then 'Pergunta aberta'
  end,
  topic=case when supporting_text like '%Tema: %' then split_part(supporting_text,'Tema: ',2) else null end
where supporting_text like 'Pilar:%';
