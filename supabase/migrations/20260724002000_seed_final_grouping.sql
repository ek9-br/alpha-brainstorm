-- Final reviewed grouping for the 255 contributions collected in ALPHA2026.
-- The original contributions remain immutable and are linked to exactly one
-- consolidated initiative so participants can inspect the grouping while voting.

do $$
begin
  if (select status from public.brainstorm_sessions where code = 'ALPHA2026')
     <> 'AI_GROUPING' then
    raise exception 'ALPHA2026 must be in AI_GROUPING before the final grouping is created';
  end if;
  if exists (
    select 1
    from public.brainstorm_consolidated_ideas c
    join public.brainstorm_sessions s on s.id = c.session_id
    where s.code = 'ALPHA2026'
  ) then
    raise exception 'ALPHA2026 already has consolidated ideas';
  end if;
end;
$$;

create temporary table final_group_defs(
  code text primary key,
  area_slug text not null,
  display_order integer not null,
  title text not null,
  description text not null
) on commit drop;

insert into final_group_defs(code, area_slug, display_order, title, description) values
('M1','marketing',1,'Programa de parcerias e indicações qualificadas','Reúne propostas de aquisição por contadores, despachantes, clientes indicadores e outros parceiros. Foram agrupadas porque usam o mesmo mecanismo: transformar relações de confiança em leads com perfil aderente.'),
('M2','marketing',2,'Presença estratégica em eventos de comércio exterior','Consolida eventos próprios, estandes, palestras e networking. As contribuições foram unidas porque dependem de presença ativa no ecossistema para gerar autoridade, relacionamento e oportunidades comerciais.'),
('M3','marketing',3,'Segmentação do público ideal e otimização da aquisição digital','Agrupa definição do cliente ideal, mídia paga, SEO, regiões, canais, influenciadores e criativos direcionados. Todas buscam elevar a qualidade dos leads pela escolha mais precisa de público, mensagem e canal.'),
('M4','marketing',4,'Atribuição de campanhas até a venda','Reúne rastreamento da origem do lead, integração com CRM, CAC, conversão e análise por campanha. O ponto comum é ligar investimento de marketing ao fechamento real para decidir onde concentrar o orçamento.'),
('M5','marketing',5,'Presença profissional no Instagram e LinkedIn','Consolida frequência, formatos mais humanos, vídeos e posicionamento corporativo nas redes. Foram agrupadas por tratarem da consistência e da qualidade da presença pública da Alpha.'),
('M6','marketing',6,'Prova social e conteúdo de autoridade','Agrupa casos, deferimentos, depoimentos, bastidores e apresentação da equipe. Todas reduzem insegurança e aumentam confiança mostrando evidências concretas da competência e dos resultados da Alpha.'),
('M7','marketing',7,'Nutrição contínua dos leads ainda não prontos','Reúne conteúdo, cadência e acompanhamento de médio prazo. Foram unidas porque tratam do mesmo problema: manter relacionamento com oportunidades que ainda não estão prontas para comprar.'),
('M8','marketing',8,'Governança da produção e aprovação de conteúdo','Consolida calendário, prioridades, responsáveis, produção em blocos, aprovações e capacidade. Todas redesenham o fluxo interno para que demandas operacionais não impeçam conteúdo e análise de resultados.'),

('A1','adm-rh-financeiro',9,'Lembretes automáticos e autocorreção do ponto','Reúne alarmes, notificações, integração ao Painel Alpha e conferência pelo próprio colaborador. As ideias foram agrupadas por prevenir esquecimentos antes que se tornem ajustes manuais do RH.'),
('A2','adm-rh-financeiro',10,'Registro de ponto mais visível ou automático','Consolida ponto físico, crachá e registro vinculado à entrada. Todas mudam o momento ou o dispositivo do registro para torná-lo inevitável e simples.'),
('A3','adm-rh-financeiro',11,'Orientação, indicadores e responsabilização sobre o ponto','Agrupa treinamento, indicadores individuais, metas e tratamento de reincidências. O tema comum é criar consciência e responsabilidade contínua pelo registro correto.'),
('A4','adm-rh-financeiro',12,'Recrutamento multicanal e programa de indicações','Reúne universidades, redes sociais, busca ativa, recrutadoras e indicação de colaboradores. Foram agrupadas por ampliarem as fontes de candidatos qualificados.'),
('A5','adm-rh-financeiro',13,'Seleção por perfil e retenção nos primeiros meses','Consolida pré-seleção, fit cultural, capacidade de aprendizagem, transparência da vaga e acompanhamento inicial. Todas buscam qualidade da contratação, não apenas volume de candidatos.'),
('A6','adm-rh-financeiro',14,'Previsão de faturamento integrada ao funil comercial','Agrupa valor, probabilidade, data, contratos, pagamentos e comparação previsto versus realizado. As propostas constroem uma única visão antecipada do caixa a partir do pipeline.'),
('A7','adm-rh-financeiro',15,'Desenvolvimento de receitas recorrentes','Reúne novos serviços, assinaturas, coworking e ofertas complementares. Foram unidas porque reduzem a dependência de vendas pontuais e aumentam a previsibilidade.'),
('A8','adm-rh-financeiro',16,'Governança financeira de preços, despesas e reconhecimento','Consolida planejamento mensal, competência, tarifários, despesas e limites de comissão. Todas melhoram regras e qualidade dos dados usados na gestão financeira.'),
('A9','adm-rh-financeiro',17,'Canal único para solicitações e informações internas','Agrupa centralização de pedidos, responsáveis, prazos e dados obrigatórios. O objetivo comum é reduzir mensagens dispersas, espera e retrabalho entre áreas.'),
('A10','adm-rh-financeiro',18,'Padronização e automação de documentos administrativos','Reúne modelos, consultas, documentos iniciais e fluxos automáticos. Foram agrupadas porque eliminam repetição e erros na preparação e circulação de documentos.'),
('A11','adm-rh-financeiro',19,'Validação final antes da elaboração do contrato','Consolida escopo, preço, pagamento, formulário, resumo ou pré-contrato e aceite. Todas criam uma trava para o Financeiro receber condições definitivas antes de formalizar.'),

('C1','comercial',20,'Gestão das perdas e objeções baseada em dados','Reúne motivos de desistência, etapas do funil, gravações, origem e reuniões de resultado. Foram agrupadas por transformar perdas comerciais em aprendizado mensurável.'),
('C2','comercial',21,'Diagnóstico consultivo antes da proposta','Agrupa levantamento de riscos, oportunidades, plano de ação e necessidade específica. Todas antecipam valor por meio de uma compreensão mais profunda do cliente.'),
('C3','comercial',22,'Comunicação do valor e da segurança entregues pela Alpha','Consolida expertise, estrutura, personalização, estatísticas, ROI e resultados. O ponto comum é tornar o valor da assessoria tangível antes da proposta.'),
('C4','comercial',23,'Comunicação da urgência e do custo de adiar','Reúne oportunidades perdidas, concorrência, limitações e participação dos decisores. Todas ajudam o cliente a compreender o custo real de postergar a decisão.'),
('C5','comercial',24,'Política de preço, pagamento e incentivos de fechamento','Agrupa faixas de honorários, formas de pagamento, bônus e descontos. Foram unidas porque alteram a condição econômica da proposta e exigem controle de margem.'),
('C6','comercial',25,'Qualificação dos leads e equilíbrio da capacidade comercial','Consolida pré-qualificação, informações antes da call e distribuição entre Closers. Todas melhoram a relação entre qualidade da oportunidade e capacidade de atendimento.'),
('C7','comercial',26,'Automação e centralização da rotina do Closer','Reúne CRM, propostas, registros e eliminação de preenchimento duplicado. As ideias foram agrupadas por liberarem tempo de venda mediante redução de burocracia.'),
('C8','comercial',27,'Treinamento e apoio da coordenação nos fechamentos','Agrupa negociação, objeções, padronização e apoio em casos difíceis. Todas elevam desempenho por desenvolvimento de competência e suporte de liderança.'),
('C9','comercial',28,'Cadência de follow-up e recuperação de leads','Consolida contato rápido, sequências por etapa, mensagens, ligações e respescagem. Foram unidas porque definem quando e como manter cada oportunidade ativa até uma decisão.'),

('D1','desenvolvimento',29,'Portal do cliente para processos, documentos, prazos e feedback','Reúne acompanhamento, pendências, upload, alertas, riscos e pesquisa final. Todas propõem uma experiência digital única para dar transparência e autonomia ao cliente.'),
('D2','desenvolvimento',30,'Produtos digitais escaláveis para comércio exterior','Agrupa assinaturas, conteúdo, agentes de dúvidas, análises automatizadas e serviços com IA. O elemento comum é gerar valor ou receita sem crescimento proporcional do esforço manual.'),
('D3','desenvolvimento',31,'Plataforma ou CRM para parceiros','Consolida soluções destinadas a despachantes e outros parceiros. Foram separadas do portal do cliente porque o usuário, a jornada e a oportunidade de negócio são diferentes.'),
('D4','desenvolvimento',32,'Plataforma interna integrada','Reúne CRM, processos, integrações, informações centralizadas e redução de planilhas. Todas propõem uma base operacional única para a empresa.'),
('D5','desenvolvimento',33,'Automação da coleta e conferência de documentos','Agrupa pendências, duplicidade, validade, leitura e lançamento automático. O objetivo comum é reduzir o trabalho manual e os erros na entrada de documentos.'),
('D6','desenvolvimento',34,'Automação da geração de contratos, minutas e procurações','Consolida documentos produzidos a partir de dados e modelos validados. Foram agrupadas por compartilharem a mesma cadeia de geração documental.'),
('D7','desenvolvimento',35,'Automação de comissões e controles operacionais','Reúne comissões, entradas, deferimentos e indicadores recorrentes. Todas automatizam controles internos estruturados e repetitivos.'),
('D8','desenvolvimento',36,'Canal único e priorização do portfólio de tecnologia','Agrupa chamados, impacto, prioridade, prazo, responsável e status. As contribuições foram unidas por tratarem da governança da fila de tecnologia.'),
('D9','desenvolvimento',37,'Segurança, LGPD e continuidade dos sistemas','Consolida acessos, backups, monitoramento, documentação e planos alternativos. Todas reduzem risco de indisponibilidade, perda ou uso indevido de dados.'),
('D10','desenvolvimento',38,'Automação comercial e inteligência de oportunidades com IA','Reúne ligações, follow-up, identificação de serviços e inteligência no CRM. Foram agrupadas pelo efeito direto da tecnologia sobre aquisição e expansão de receita.'),
('D11','desenvolvimento',39,'Gestão do parque tecnológico e onboarding de equipamentos','Consolida manutenção preventiva, testes e configuração de equipamentos. Todas reduzem interrupções e o tempo de preparação de colaboradores.'),

('O1','operacional',40,'Revisão técnica e aprendizado com exigências e indeferimentos','Reúne análise de causas, checagens, revisão de risco e aprendizado com casos anteriores. Foram agrupadas por buscarem deferimento mais rápido e correto na primeira análise.'),
('O2','operacional',41,'Base de conhecimento por fiscal e região com apoio de IA','Consolida playbook, fontes, datas, atualização, busca e integração ao Painel Alpha. Todas tornam entendimentos regionais consultáveis e confiáveis para Operacional e Comercial.'),
('O3','operacional',42,'Cronograma regressivo e alertas para documentação','Agrupa prazos, checklist, garantias, cobranças, notificações e reprogramação. O mecanismo comum é começar pelo protocolo e antecipar cada dependência documental.'),
('O4','operacional',43,'Integração antecipada com a contabilidade do cliente','Reúne identificação da contabilidade, prazo de resposta e antecipação de documentos demorados. Foi separada por depender de um ator externo específico e crítico.'),
('O5','operacional',44,'Gestão centralizada de demandas, prioridades e agenda','Consolida critérios de prioridade, blocos de trabalho, agenda e acompanhamento. Todas organizam a capacidade diária da Equipe Operacional.'),
('O6','operacional',45,'Acompanhamento compartilhado do andamento dos processos','Agrupa status, pendências, documentos e continuidade entre analistas. O objetivo comum é dar visibilidade e evitar que o processo dependa da memória de uma pessoa.'),
('O7','operacional',46,'Distribuição dos processos por complexidade e esforço','Reúne classificação e equilíbrio de carga entre analistas. Foram agrupadas por tratarem especificamente da alocação justa da capacidade.'),
('O8','operacional',47,'Apoio para tarefas operacionais básicas','Consolida auxiliares, estagiários e divisão de funções. Todas liberam analistas de tarefas simples para atividades técnicas de maior valor.'),
('O9','operacional',48,'Padronização do atendimento, documentos e limites do escopo','Agrupa padrões de processo, armazenamento, contato e tarefas fora da assessoria. As ideias foram unidas por reduzirem variação, retrabalho e desvios de escopo.');

create temporary table final_idea_mapping(
  idea_id uuid primary key,
  group_code text not null
) on commit drop;

insert into final_idea_mapping(idea_id, group_code)
select i.id,
  case a.slug
    when 'marketing' then
      case
        when lower(r.title) like '%otimização%' then 'M8'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'evento|estande|palestra|network' then 'M2'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'parceir|indica|contador|despach|afiliad|comiss' then 'M1'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'depoimento|case|caso de sucesso|deferimento|prova social|bastidor|equipe|autoridade' then 'M6'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'nutri|aquec|longo prazo|não.*pronto|nao.*pronto|acompanha.*lead' then 'M7'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'instagram|linkedin|rede social|vídeo|video|humaniz' then 'M5'
        when lower(r.title) like '%redução de custos%'
          and lower(i.text || ' ' || coalesce(i.expected_result,'')) !~ 'criativo|públic|publico|segment|região|regiao|canal|seo|influenci' then 'M4'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'crm|rastre|origem|cac|métrica|metrica|conversão|conversao|venda.*campanha|campanha.*venda' then 'M4'
        else 'M3'
      end
    when 'adm-rh-financeiro' then
      case
        when lower(r.title) like '%formalização%' then 'A11'
        when lower(r.title) like '%controle de ponto%' then
          case
            when lower(i.text) ~ 'físic|fisic|catraca|crachá|cracha|entrada|biometr' then 'A2'
            when lower(i.text) ~ 'treina|orienta|conscient|advert|penal|indicador|gráfico|grafico|meta|responsab|reincid' then 'A3'
            else 'A1'
          end
        when lower(r.title) like '%recrutamento%' then
          case
            when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'perfil|fit|cultur|teste|aprendi|reten|experiência|experiencia|vivência|vivencia|pré-sele|pre-sele|acompanha' then 'A5'
            else 'A4'
          end
        when lower(r.title) like '%previsibilidade%' then
          case
            when lower(i.text) ~ 'recorr|assinatura|cowork|novo.*servi|servi.*novo|mensalidade' then 'A7'
            when lower(i.text) ~ 'competência|competencia|despesa|tarif|comissão|comissao|preço|preco|govern' then 'A8'
            else 'A6'
          end
        else
          case
            when lower(i.text) ~ 'contrato|document|cnpj|consulta|modelo|minuta|procuração|procuracao|autom' then 'A10'
            when lower(i.text) ~ 'recrut|contrata|colaborador|turnover|integração|integracao' then 'A5'
            when lower(i.text) ~ 'ponto' then 'A1'
            else 'A9'
          end
      end
    when 'comercial' then
      case
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'follow|cadência|cadencia|respesc|reativ|sequência|sequencia|não.*esquec|nao.*esquec|contato imediato|ligar.*lead' then 'C9'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'preço|preco|desconto|pagamento|parcel|honorário|honorario|bônus|bonus|taxa|valor.*faixa' then 'C5'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'treina|coorden|role.?play|capacita|objeç|objec.*trein' then 'C8'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'crm|automat|sistema|centraliz|preench|burocra|proposta.*autom|duplic' then 'C7'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'qualific|pré.?qual|pre.?qual|distribui|capacidade|agenda.*closer|informação.*call|informacao.*call' then 'C6'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'urgên|urgen|adiar|perd.*oportun|concorr|decisor|fechar.*call|radar.*limit' then 'C4'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'diagnóst|diagnost|risco|oportunidade|plano de ação|plano de acao|necessidade|consultiv' then 'C2'
        when lower(i.text || ' ' || coalesce(i.expected_result,'')) ~ 'valor|seguran|expertise|estrutura|roi|resultado|garantia|personaliz|credibil|confian' then 'C3'
        else 'C1'
      end
    when 'desenvolvimento' then
      case
        when lower(r.title) like '%tecnologia para crescimento%' then
          case
            when lower(i.text) ~ 'parceir|despachante' then 'D3'
            when lower(i.text) ~ 'portal|cliente.*acompan|acompan.*cliente|upload|feedback' then 'D1'
            when lower(i.text) ~ 'intern|integra|planilha|painel|crm.*empresa|processo.*sistema' then 'D4'
            else 'D2'
          end
        when lower(r.title) like '%automação de atividades%' then
          case
            when lower(i.text) ~ 'contrato|minuta|procuração|procuracao|documento societ|cnpj' then 'D6'
            when lower(i.text) ~ 'comiss|deferimento|entrada|indicador|controle.*oper' then 'D7'
            when lower(i.text) ~ 'callix|ligação|ligacao|follow|comercial|oportunidade|crm' then 'D10'
            else 'D5'
          end
        when lower(r.title) like '%priorização e entrega%' then
          case
            when lower(i.text) ~ 'computador|notebook|webcam|telefone|tv|equipamento|manutenção|manutencao|onboarding' then 'D11'
            else 'D8'
          end
        else
          case
            when lower(i.text) ~ 'seguran|lgpd|backup|acesso|senha|continuidade|indispon|monitor' then 'D9'
            when lower(i.text) ~ 'computador|notebook|webcam|telefone|equipamento|manutenção|manutencao|onboarding' then 'D11'
            else 'D4'
          end
      end
    when 'operacional' then
      case
        when lower(r.title) like '%base de conhecimento%' then 'O2'
        when lower(r.title) like '%gestão de demandas%' then
          case when lower(i.text) ~ 'status|acompanha|compartilh|painel|planilha|visib' then 'O6' else 'O5' end
        when lower(r.title) like '%protocolos no fim%' then
          case
            when lower(i.text) ~ 'contab' then 'O4'
            when lower(i.text) ~ 'sistema|centraliz|painel|acompanha|status|integra' then 'O6'
            else 'O3'
          end
        when lower(r.title) like '%capacidade e deferimento%' then
          case
            when lower(i.text) ~ 'base|playbook|fiscal|região|regiao|entendimento|conhecimento' then 'O2'
            when lower(i.text) ~ 'document|checklist|prazo|alerta|cronograma|cliente.*env' then 'O3'
            when lower(i.text) ~ 'auxiliar|estagi|assistente|tarefa.*básic|tarefa.*basic' then 'O8'
            else 'O1'
          end
        else
          case
            when lower(i.text) ~ 'complex|distribui|carga|esforço|esforco' then 'O7'
            when lower(i.text) ~ 'auxiliar|estagi|assistente|tarefa.*básic|tarefa.*basic' then 'O8'
            when lower(i.text) ~ 'status|acompanha|compartilh|painel|visib' then 'O6'
            when lower(i.text) ~ 'fiscal|região|regiao|entendimento|base|conhecimento' then 'O2'
            else 'O9'
          end
      end
    else null
  end
from public.brainstorm_ideas i
join public.brainstorm_sessions s on s.id = i.session_id and s.code = 'ALPHA2026'
join public.brainstorm_areas a on a.id = i.area_id
join public.brainstorm_rounds r on r.id = i.round_id;

do $$
declare
  idea_total integer;
  mapped_total integer;
  empty_groups integer;
begin
  select count(*) into idea_total
  from public.brainstorm_ideas i
  join public.brainstorm_sessions s on s.id = i.session_id
  where s.code = 'ALPHA2026';
  select count(*) into mapped_total from final_idea_mapping;
  select count(*) into empty_groups
  from final_group_defs d
  where not exists (select 1 from final_idea_mapping m where m.group_code = d.code);

  if idea_total <> 255 or mapped_total <> idea_total then
    raise exception 'Expected 255 mapped ideas, got % of %', mapped_total, idea_total;
  end if;
  if empty_groups > 0 then
    raise exception 'The proposed grouping contains % empty groups', empty_groups;
  end if;
  if exists (
    select 1 from final_idea_mapping m
    left join final_group_defs d on d.code = m.group_code
    where d.code is null
  ) then
    raise exception 'At least one contribution was mapped to an unknown group';
  end if;
end;
$$;

create temporary table final_group_ids(
  code text primary key,
  id uuid not null
) on commit drop;

with inserted as (
  insert into public.brainstorm_consolidated_ideas(
    session_id, area_id, title, description, grouping_method,
    grouping_confidence, approved, display_order
  )
  select
    s.id, a.id, d.title, d.description, 'manual', null, true, d.display_order
  from final_group_defs d
  join public.brainstorm_areas a on a.slug = d.area_slug
  cross join public.brainstorm_sessions s
  where s.code = 'ALPHA2026'
  returning id, title
)
insert into final_group_ids(code, id)
select d.code, i.id
from inserted i
join final_group_defs d on d.title = i.title;

insert into public.brainstorm_consolidated_idea_sources(consolidated_idea_id, idea_id)
select g.id, m.idea_id
from final_idea_mapping m
join final_group_ids g on g.code = m.group_code;

do $$
declare
  group_total integer;
  source_total integer;
begin
  select count(*) into group_total
  from public.brainstorm_consolidated_ideas c
  join public.brainstorm_sessions s on s.id = c.session_id
  where s.code = 'ALPHA2026';
  select count(*) into source_total
  from public.brainstorm_consolidated_idea_sources src
  join public.brainstorm_consolidated_ideas c on c.id = src.consolidated_idea_id
  join public.brainstorm_sessions s on s.id = c.session_id
  where s.code = 'ALPHA2026';
  if group_total <> 48 or source_total <> 255 then
    raise exception 'Final validation failed: % groups and % sources', group_total, source_total;
  end if;
end;
$$;

update public.brainstorm_sessions s
set status = 'GROUP_REVIEW',
    current_consolidated_idea_id = (
      select c.id
      from public.brainstorm_consolidated_ideas c
      where c.session_id = s.id and c.approved
      order by c.display_order, c.created_at
      limit 1
    ),
    stage_started_at = now(),
    stage_ends_at = null,
    updated_at = now()
where s.code = 'ALPHA2026';
