import {describe,expect,it} from 'vitest';
import {buildExecutionPlans,ResultRow} from './ResultsDashboard';

const row=(overrides:Partial<ResultRow>):ResultRow=>({
 id:crypto.randomUUID(),
 area_id:'marketing',
 area_name:'Marketing',
 title:'Ideia',
 description:'',
 display_order:1,
 vote_count:10,
 contribution_count:2,
 impact:4,
 viability:4,
 speed:4,
 scalability:4,
 overall_score:4,
 classification:'Quick Win',
 ...overrides
});

describe('plano de execução por setor',()=>{
 it('separa os setores e reinicia a prioridade dentro de cada um',()=>{
  const plans=buildExecutionPlans([
   row({id:'c1',area_id:'comercial',area_name:'Comercial',title:'Comercial'}),
   row({id:'m1',title:'Marketing'})
  ]);
  expect(plans.map(plan=>plan.areaName)).toEqual(['Marketing','Comercial']);
  expect(plans.map(plan=>plan.rows[0].title)).toEqual(['Marketing','Comercial'])
 });

 it('ordena por nota geral e usa rapidez no desempate',()=>{
  const [plan]=buildExecutionPlans([
   row({id:'a',title:'Mais rápida',overall_score:4.5,speed:5}),
   row({id:'b',title:'Mais lenta',overall_score:4.5,speed:3}),
   row({id:'c',title:'Menor nota',overall_score:4.2,speed:5})
  ]);
  expect(plan.rows.map(item=>item.title)).toEqual(['Mais rápida','Mais lenta','Menor nota'])
 })
});
