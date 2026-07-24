export type SessionStatus='WAITING'|'PRESENTING'|'IDEATION_OPEN'|'IDEATION_CLOSED'|'AI_GROUPING'|'GROUP_REVIEW'|'VOTING_OPEN'|'VOTING_WAITING'|'RESULTS'|'FINISHED';
export type Area={id:string;name:string;slug:string;display_order:number};
export type Session={id:string;code:string;title:string;status:SessionStatus;current_round_id:string|null;current_consolidated_idea_id:string|null;stage_ends_at:string|null};
export type Participant={id:string;session_id:string;anonymous_token:string;primary_area_id:string};
export type Round={id:string;session_id:string;area_id:string;title:string;question:string;supporting_text:string|null;pillar?:'Crescimento'|'Redução de custos'|'Otimização'|'Pergunta aberta'|null;topic?:string|null;context_text?:string|null;kpis?:string[];duration_seconds:number;display_order:number};
export type Idea={id:string;text:string;expected_result:string|null;created_at:string};
export type GroupSourceIdea={id:string;text:string;expected_result:string|null;question:string};
export type ConsolidatedIdea={id:string;area_id:string;area_name?:string;title:string;description:string;display_order:number;source_count?:number;source_ideas?:GroupSourceIdea[]};
export const CRITERIA=[
 ['impact','Impacto para a Alpha','Quanto esta iniciativa pode melhorar resultados, custos, estratégia ou experiência do cliente?'],
 ['viability','Viabilidade','Considerando investimento, equipe, complexidade e risco, é possível executar?'],
 ['speed','Rapidez','Em quanto tempo esta iniciativa pode começar a gerar resultados?'],
 ['scalability','Escalabilidade','A solução acompanha o crescimento da empresa e reduz trabalho manual?']
] as const;
export type CriterionKey=typeof CRITERIA[number][0];
export type Ratings=Record<CriterionKey,number>;
