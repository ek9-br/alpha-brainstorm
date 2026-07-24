import {CheckCircle2,CircleAlert,PlayCircle} from 'lucide-react';
import {AdminWorkspace} from './AdminGrouping';

type CallResult={ok:boolean;data?:Record<string,unknown>;error?:string};

export function AdminVotingPreparation({workspace,busy,onCall,onRefresh}:{workspace:AdminWorkspace;busy:boolean;onCall:(action:string,payload?:Record<string,unknown>)=>Promise<CallResult>;onRefresh:()=>Promise<void>}){
 const groups=[...workspace.groups].sort((a,b)=>a.display_order-b.display_order);
 const approved=groups.filter(group=>group.approved);
 const linked=new Set(workspace.sources.map(source=>source.idea_id));
 const ungrouped=workspace.ideas.filter(idea=>!linked.has(idea.id)).length;
 const emptyApproved=approved.filter(group=>!workspace.sources.some(source=>source.consolidated_idea_id===group.id)).length;
 const inReview=workspace.session.status==='GROUP_REVIEW';
 const ready=approved.length>0&&emptyApproved===0&&ungrouped===0&&inReview;
 const openVoting=async()=>{
  if(!ready||!confirm(`Abrir uma única votação contínua com ${approved.length} ideias? Cada participante avançará no próprio ritmo.`))return;
  const result=await onCall('set_status',{status:'VOTING_OPEN'});
  if(result.ok)await onRefresh();
 };

 return <section className="mt-8"><div><p className="font-semibold text-brand-700">Fase 3</p><h2 className="text-2xl font-black">Preparação da votação contínua</h2><p className="mt-1 text-sm text-slate-600">Uma única abertura libera toda a sequência. Cada participante salva uma ideia por vez e retoma de onde parou.</p></div>
  <div className="mt-5 grid gap-3 sm:grid-cols-3"><CheckItem ok={approved.length>0&&emptyApproved===0} label="Ideias aprovadas" detail={emptyApproved?`${emptyApproved} sem contribuições`:`${approved.length} prontas`}/><CheckItem ok={ungrouped===0} label="Contribuições tratadas" detail={ungrouped===0?'Nenhuma pendência':`${ungrouped} não agrupada(s)`}/><CheckItem ok={inReview} label="Etapa de revisão" detail={inReview?'Revisão ativa':'A votação já avançou para outra etapa'}/></div>
  <div className={`mt-5 rounded-2xl border p-5 ${ready?'border-green-200 bg-green-50':'border-amber-200 bg-amber-50'}`}><div className="flex gap-3">{ready?<CheckCircle2 className="shrink-0 text-green-700"/>:<CircleAlert className="shrink-0 text-amber-700"/>}<div><h3 className="font-bold">{ready?'Tudo pronto para votar':'Existem pendências antes da votação'}</h3><p className="mt-1 text-sm text-slate-700">{ready?`Ao abrir, as ${approved.length} ideias ficarão disponíveis em sequência para todos.`:'Resolva os itens indicados acima. O servidor também bloqueará uma abertura incompleta.'}</p></div></div><button className="btn-primary mt-4 w-full" disabled={busy||!ready} onClick={openVoting}><PlayCircle className="mr-2" size={19}/>Abrir votação contínua</button></div>
  <details className="card mt-5"><summary className="cursor-pointer font-bold">Ver a sequência completa ({approved.length} ideias)</summary><p className="mt-2 text-sm text-slate-600">A ordem abaixo será igual para todos, mas cada pessoa avançará no próprio ritmo.</p>
   <div className="mt-4 grid gap-2 sm:grid-cols-2">{approved.map((group,index)=>{const count=workspace.sources.filter(source=>source.consolidated_idea_id===group.id).length;return <div className="flex gap-3 rounded-xl border border-slate-200 p-3" key={group.id}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">{index+1}</span><div><h4 className="font-bold">{group.title}</h4><p className="mt-1 text-xs text-slate-500">{count} contribuição(ões) agrupada(s)</p></div></div>})}</div>
  </details>
 </section>
}

function CheckItem({ok,label,detail}:{ok:boolean;label:string;detail:string}){return <div className={`card border-l-4 ${ok?'border-l-green-500':'border-l-amber-500'}`}><div className="flex gap-2">{ok?<CheckCircle2 className="shrink-0 text-green-600" size={19}/>:<CircleAlert className="shrink-0 text-amber-600" size={19}/>}<div><p className="font-bold">{label}</p><p className="mt-1 text-sm text-slate-600">{detail}</p></div></div></div>}
