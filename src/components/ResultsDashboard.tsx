import {ReactNode,useEffect,useMemo,useState} from 'react';
import {BarChart3,ListOrdered,RefreshCw,Sparkles,Trophy,Vote} from 'lucide-react';
import {configured,supabase} from '../lib/supabase';

export type ResultRow={
 id:string;
 area_id:string;
 area_name:string;
 title:string;
 description:string;
 display_order:number;
 vote_count:number;
 contribution_count:number;
 impact:number|null;
 viability:number|null;
 speed:number|null;
 scalability:number|null;
 overall_score:number|null;
 classification:string
};

type ExecutionPlan={areaId:string;areaName:string;rows:ResultRow[]};
const criteria:[keyof ResultRow,string][]=[
 ['impact','Impacto'],
 ['viability','Viabilidade'],
 ['speed','Rapidez'],
 ['scalability','Escalabilidade']
];
const sectorOrder=['Marketing','Adm: RH e Financeiro','Comercial','Desenvolvimento','Operacional'];

export function buildExecutionPlans(rows:ResultRow[]):ExecutionPlan[]{
 const sectors=[...new Map(rows.map(row=>[row.area_id,{areaId:row.area_id,areaName:row.area_name}])).values()]
  .sort((left,right)=>{
   const leftIndex=sectorOrder.indexOf(left.areaName);
   const rightIndex=sectorOrder.indexOf(right.areaName);
   return (leftIndex<0?sectorOrder.length:leftIndex)-(rightIndex<0?sectorOrder.length:rightIndex)||left.areaName.localeCompare(right.areaName)
  });
 return sectors.map(sector=>({
  ...sector,
  rows:rows.filter(row=>row.area_id===sector.areaId).sort(executionComparator)
 }))
}

function executionComparator(left:ResultRow,right:ResultRow){
 const compare=(key:'overall_score'|'speed'|'viability'|'impact'|'scalability')=>Number(right[key]??-1)-Number(left[key]??-1);
 return compare('overall_score')||compare('speed')||compare('viability')||compare('impact')||compare('scalability')||left.display_order-right.display_order
}

export function ResultsDashboard({code,published,title='Resultados'}:{code:string;published:boolean;title?:string}){
 const [rows,setRows]=useState<ResultRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async()=>{
  if(!published||!configured)return;
  setLoading(true);
  setError('');
  const {data,error}=await supabase.rpc('brainstorm_get_published_results',{p_session_code:code});
  if(error)setError('Não foi possível carregar os resultados publicados.');
  else setRows((data||[]) as ResultRow[]);
  setLoading(false)
 };
 useEffect(()=>{void load()},[code,published]);
 const plans=useMemo(()=>buildExecutionPlans(rows),[rows]);
 const totalVotes=rows.reduce((sum,row)=>sum+Number(row.vote_count),0);
 const totalContributions=rows.reduce((sum,row)=>sum+Number(row.contribution_count),0);
 const average=(key:keyof ResultRow)=>{
  const voted=rows.filter(row=>row.vote_count>0&&row[key]!=null);
  const weight=voted.reduce((sum,row)=>sum+Number(row.vote_count),0);
  return weight?voted.reduce((sum,row)=>sum+Number(row[key])*Number(row.vote_count),0)/weight:0
 };

 if(!published)return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-center"><BarChart3 className="mx-auto text-slate-400" size={40}/><h2 className="mt-3 text-2xl font-black">{title}</h2><p className="mt-2 text-slate-600">Os resultados permanecerão ocultos até o facilitador finalizar a votação.</p></section>;

 return <section className="mt-8">
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div>
    <p className="font-semibold text-brand-700">Fase 5</p>
    <h2 className="text-3xl font-black">{title}</h2>
    <p className="mt-1 text-slate-600">Lista de execução por setor, calculada com peso 1,30 para votos do próprio setor e 1,00 para os demais.</p>
   </div>
   <button className="btn-secondary" disabled={loading} onClick={load}><RefreshCw className="mr-2" size={17}/>{loading?'Atualizando…':'Atualizar'}</button>
  </div>

  {error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}

  <div className="mt-5 grid gap-3 sm:grid-cols-3">
   <Summary icon={<Trophy/>} label="Ideias classificadas" value={rows.length}/>
   <Summary icon={<Vote/>} label="Avaliações recebidas" value={totalVotes}/>
   <Summary icon={<Sparkles/>} label="Contribuições agrupadas" value={totalContributions}/>
  </div>

  <div className="card mt-5 border-brand-200 bg-brand-50">
   <div className="flex items-start gap-3">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-700"><ListOrdered/></span>
    <div>
     <h3 className="font-black text-brand-900">Como a ordem de execução é definida</h3>
     <p className="mt-1 text-sm text-brand-900">Cada setor possui sua própria lista. A ordem considera Nota geral, Rapidez, Viabilidade, Impacto e Escalabilidade, nessa sequência para desempate.</p>
     <p className="mt-2 text-sm font-black text-brand-900">O pilar não é usado nem exibido nesta etapa.</p>
    </div>
   </div>
  </div>

  <div className="card mt-5">
   <div className="flex items-center gap-2"><BarChart3 className="text-brand-700"/><h3 className="font-bold">Médias gerais dos critérios</h3></div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{criteria.map(([key,label])=><Score key={String(key)} label={label} value={average(key)}/>)}</div>
  </div>

  <div className="mt-7 space-y-7">
   {plans.map(plan=><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={plan.areaId}>
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
     <div><p className="text-xs font-bold uppercase tracking-widest text-brand-200">Ordem de execução do setor</p><h3 className="mt-1 text-2xl font-black">{plan.areaName}</h3></div>
     <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{plan.rows.length} iniciativa(s)</span>
    </header>
    <div className="divide-y divide-slate-200">
     {plan.rows.map((row,index)=><article className="p-5" key={row.id}>
      <div className="flex flex-wrap items-start justify-between gap-4">
       <div className="flex min-w-0 flex-1 gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-xl font-black ${index===0?'bg-brand-600 text-white':'bg-slate-100 text-slate-700'}`}>{index+1}</span>
        <div className="min-w-0">
         <p className="text-xs font-black uppercase tracking-wide text-brand-700">{index===0?'Primeira prioridade':`${index+1}ª prioridade`}</p>
         <div className="mt-1 flex flex-wrap items-center gap-2"><h4 className="text-xl font-black">{row.title}</h4><span className={`rounded-full px-2 py-1 text-xs font-bold ${classColor(row.classification)}`}>{row.classification}</span></div>
         {row.description&&<p className="mt-2 text-sm leading-relaxed text-slate-600">{row.description}</p>}
        </div>
       </div>
       <div className="rounded-xl bg-brand-50 px-4 py-3 text-right">
        <p className="text-3xl font-black text-brand-700">{Number(row.overall_score||0).toFixed(2)}</p>
        <p className="text-xs font-semibold text-brand-900">Nota geral / 5</p>
       </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
       <Mini label="Critérios" value={`Impacto ${format(row.impact)} · Viabilidade ${format(row.viability)} · Rapidez ${format(row.speed)} · Escala ${format(row.scalability)}`}/>
       <Mini label="Participação" value={`${row.vote_count} votos`}/>
       <Mini label="Origem do agrupamento" value={`${row.contribution_count} contribuição(ões)`}/>
      </div>
      <details className="mt-4 rounded-xl bg-slate-50 p-4">
       <summary className="cursor-pointer font-bold">Ver detalhamento das notas</summary>
       <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{criteria.map(([key,label])=><Score key={String(key)} label={label} value={Number(row[key]||0)}/>)}</div>
      </details>
     </article>)}
    </div>
   </section>)}
   {!loading&&plans.length===0&&<div className="card text-center text-slate-500">Os resultados aparecerão aqui quando a apuração for publicada.</div>}
  </div>
 </section>
}

function Summary({icon,label,value}:{icon:ReactNode;label:string;value:number}){return <div className="card flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div></div>}
function Score({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-2 text-sm"><span>{label}</span><strong>{value.toFixed(2)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600" style={{width:`${Math.min(100,value/5*100)}%`}}/></div></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>}
function format(value:number|null){return Number(value||0).toFixed(2)}
function classColor(value:string){if(value==='Quick Win')return'bg-green-100 text-green-800';if(value==='Aposta Estratégica')return'bg-purple-100 text-purple-800';if(value==='Melhoria Incremental')return'bg-blue-100 text-blue-800';return'bg-slate-100 text-slate-700'}
