import {ContinuousVoting,VotingIdea} from '../components/ContinuousVoting';
import {Participant,Session} from '../types';

const session:Session={
 id:'preview-session',
 code:'ALPHA2026',
 title:'Prévia da votação',
 status:'VOTING_OPEN',
 current_round_id:null,
 current_consolidated_idea_id:null,
 stage_ends_at:null
};
const participant:Participant={
 id:'preview-participant',
 session_id:session.id,
 anonymous_token:'00000000-0000-0000-0000-000000000000',
 primary_area_id:'preview-marketing'
};
const firstIdea:VotingIdea={
 id:'preview-1',
 area_id:'preview-marketing',
 area_name:'Marketing',
 title:'Programa de parcerias e indicações qualificadas',
 description:'Reúne propostas de aquisição por contadores, despachantes, clientes indicadores e outros parceiros. Foram agrupadas porque usam o mesmo mecanismo: transformar relações de confiança em leads com perfil aderente.',
 display_order:1,
 source_count:3,
 source_ideas:[
  {id:'preview-source-1',question:'Marketing — Crescimento',text:'Criar parcerias com contadores, despachantes e empresas que atendem empresários.',expected_result:'Gerar indicações de potenciais importadores.'},
  {id:'preview-source-2',question:'Marketing — Crescimento',text:'Criar um programa de parceria com bonificação progressiva.',expected_result:'Aumentar o volume de indicações qualificadas.'},
  {id:'preview-source-3',question:'Marketing — Redução de custos',text:'Registrar a origem dos leads para direcionar o investimento aos canais de maior desempenho.',expected_result:'Reduzir o custo de aquisição.'}
 ],
 my_ratings:null
};
const ideas:VotingIdea[]=Array.from({length:48},(_,index)=>index===0?firstIdea:{
 ...firstIdea,
 id:`preview-${index+1}`,
 title:`Iniciativa de demonstração ${index+1}`,
 description:'Conteúdo ilustrativo usado apenas para testar a navegação entre as ideias.',
 display_order:index+1,
 source_count:0,
 source_ideas:[]
});

export default function VotingPreviewPage(){
 return <ContinuousVoting session={session} participant={participant} online previewIdeas={ideas}/>
}
