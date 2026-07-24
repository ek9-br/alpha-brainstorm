// @vitest-environment jsdom

import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ContinuousVoting} from './ContinuousVoting';

(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;

const {rpc}=vi.hoisted(()=>({rpc:vi.fn(async(name:string)=>{
 if(name==='brainstorm_get_voting_queue')return {data:{ideas:[{
   id:'idea-1',
   area_id:'marketing',
   area_name:'Marketing',
   title:'Programa de parcerias e indicações qualificadas',
   description:'Reúne propostas de aquisição por parceiros.',
   display_order:1,
   source_count:2,
   source_ideas:[
    {id:'source-1',question:'Marketing — Crescimento',text:'Criar um programa de parceiros.',expected_result:null},
    {id:'source-2',question:'Marketing — Redução de custos',text:'Medir a origem das indicações.',expected_result:'Reduzir o custo por lead.'}
   ],
   my_ratings:null
  }]},error:null};
  return {data:null,error:null}
 })}));

vi.mock('../lib/supabase',()=>({
 configured:true,
 supabase:{rpc}
}));

describe('votação contínua no mobile',()=>{
 afterEach(()=>{document.body.innerHTML='';rpc.mockClear()});

 it('renderiza a fila restaurada sem deixar a página em branco',async()=>{
  const container=document.createElement('div');
  document.body.appendChild(container);
  const root=createRoot(container);
  await act(async()=>{
   root.render(<ContinuousVoting
    session={{id:'session-1',code:'ALPHA2026',title:'Evento',status:'VOTING_OPEN',current_round_id:null,current_consolidated_idea_id:null,stage_ends_at:null}}
    participant={{id:'participant-1',session_id:'session-1',anonymous_token:'token',primary_area_id:'marketing'}}
    online
   />);
  });
  await act(async()=>{await Promise.resolve()});
  expect(container.textContent).toContain('Programa de parcerias e indicações qualificadas');
  expect(container.textContent).toContain('Responda os 4 restantes');
  expect(container.textContent).toContain('Entenda o agrupamento');
  await act(async()=>root.unmount())
 })
});
