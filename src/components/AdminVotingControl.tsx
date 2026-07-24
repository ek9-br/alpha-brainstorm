import {ReactNode,useEffect,useState} from 'react';
import {CheckCircle2,RefreshCw,Square,Users,Vote} from 'lucide-react';
import {AdminWorkspace} from './AdminGrouping';

type CallResult={ok:boolean;data?:Record<string,unknown>;error?:string};
type AreaProgress={area_name:string;participant_count:number;completed_count:number;vote_count:number;expected_votes:number;percentage:number};
export type VotingProgress={participant_count:number;connected_count:number;approved_idea_count:number;total_vote_count:number;started_count:number;completed_count:number;completion_percentage:number;idea_vote_counts:Record<string,number>;area_progress:AreaProgress[]};

export function AdminVotingControl({workspace,busy,onCall,onRefresh,onProgress}:{workspace:AdminWorkspace;busy:boolean;onCall:(action:string,payload?:Record<string,unknown>)=>Promise<CallResult>;onRefresh:()=>Promise<void>;onProgress:()=>Promise<VotingProgress|null>}){
 const [progress,setProgress]=useState<VotingProgress|null>(null);
 const approved=[...workspace.groups].filter(group=>group.approved).sort((a,b)=>a.display_order-b.display_order);
 const active=workspace.session.status==='VOTING_OPEN';
 const refresh=async()=>setProgress(await onProgress());
 useEffect(()=>{void refresh();if(!active)return;const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer)},[workspace.session.status]);
 const finish=async()=>{
  const completed=progress?.completed_count||0;const total=progress?.participant_count||0;
  if(!confirm(`Encerrar a votação e publicar os resultados? ${completed} de ${total} participantes concluíram todas as ideias.`))return;
  const result=await onCall('set_status',{status:'RESULTS'});
  if(result.ok){await onRefresh();await refresh()}
 };
 const participants=progress?.participant_count||0;
 const ideas=progress?.approved_idea_count||approved.length;
 const expected=participants*ideas;
 const votes=progress?.total_vote_count||0;
 const percentage=Number(progress?.completion_percentage||0);

 return <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Fase 4</p><h2 className="text-2xl font-black">Acompanhamento da votação</h2><p className="mt-1 text-sm text-slate-600">Todos percorrem as {approved.length} ideias no próprio ritmo. Não é necessário avançar a apresentação manualmente.</p></div><button className="btn-secondary" onClick={refresh}><RefreshCw className="mr-2" size={17}/>Atualizar métricas</button></div>
  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Users/>} label="Participantes" value={participants}/><Metric icon={<span className="size-3 rounded-full bg-green-500"/>} label="Conectados agora" value={progress?.connected_count||0}/><Metric icon={<Vote/>} label="Começaram" value={progress?.started_count||0}/><Metric icon={<CheckCircle2/>} label="Concluíram tudo" value={progress?.completed_count||0}/></div>
  <div className={`card mt-5 border-2 ${active?'border-green-500':'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-xs font-bold ${active?'bg-green-100 text-green-800':'bg-slate-100 text-slate-600'}`}>{active?'Votação contínua aberta':'Aguardando abertura'}</span><h3 className="mt-3 text-2xl font-black">Progresso geral</h3><p className="mt-1 text-slate-600">{votes} de {expected} avaliações esperadas foram salvas.</p></div><p className="text-4xl font-black text-brand-700">{percentage.toFixed(1)}%</p></div><div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600 transition-all" style={{width:`${Math.min(100,percentage)}%`}}/></div>
   {active&&<button className="btn-secondary mt-5 w-full border-red-200 text-red-700" disabled={busy} onClick={finish}><Square className="mr-2" size={18}/>Encerrar votação e publicar resultados</button>}
  </div>
  <div className="card mt-5"><h3 className="font-bold">Progresso por setor dos participantes</h3><div className="mt-4 space-y-4">{(progress?.area_progress||[]).map(area=><div key={area.area_name}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-bold">{area.area_name}</span><span className="text-slate-600">{area.completed_count} de {area.participant_count} concluíram · {Number(area.percentage).toFixed(1)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600" style={{width:`${Math.min(100,Number(area.percentage))}%`}}/></div></div>)}</div></div>
  <details className="card mt-5"><summary className="cursor-pointer font-bold">Ver recebimento de votos por ideia</summary><div className="mt-4 grid gap-2 sm:grid-cols-2">{approved.map((group,index)=>{const count=progress?.idea_vote_counts?.[group.id]||0;return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3" key={group.id}><div className="flex min-w-0 items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{index+1}</span><span className="truncate font-medium">{group.title}</span></div><span className="shrink-0 text-sm font-bold">{count}/{participants}</span></div>})}</div></details>
 </section>
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:number|string}){return <div className="card flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span><div><p className="text-sm text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div></div>}
