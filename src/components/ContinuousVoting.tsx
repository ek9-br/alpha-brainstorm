import {useEffect,useMemo,useState} from 'react';
import {AlertCircle,ArrowLeft,Check,CheckCircle2,Clock3,RotateCcw} from 'lucide-react';
import {configured,supabase} from '../lib/supabase';
import {ConsolidatedIdea,CRITERIA,Participant,Ratings,Session} from '../types';
import {Chrome} from './Chrome';

type VotingIdea=ConsolidatedIdea&{my_ratings:Ratings|null};

export function ContinuousVoting({session,participant,online}:{session:Session;participant:Participant;online:boolean}){
 const [ideas,setIdeas]=useState<VotingIdea[]>([]);
 const [index,setIndex]=useState(0);
 const [ratings,setRatings]=useState<Partial<Ratings>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [completed,setCompleted]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(()=>typeof window!=='undefined'&&window.innerWidth>=768);
 const current=ideas[index];
 const votedCount=ideas.filter(idea=>idea.my_ratings).length;
 const percentage=ideas.length?Math.round(votedCount/ideas.length*100):0;
 const remaining=ideas.length-votedCount;
 const answeredCount=CRITERIA.filter(([key])=>ratings[key]).length;
 const isLastIdea=index===ideas.length-1;

 const load=async()=>{
  setLoading(true);setError('');
  if(!configured){setLoading(false);return}
  const {data,error}=await supabase.rpc('brainstorm_get_voting_queue',{p_session_id:session.id,p_participant_id:participant.id,p_token:participant.anonymous_token});
  if(error){setError('Não foi possível carregar a fila de votação. Atualize a página e tente novamente.');setLoading(false);return}
  const queue=(data?.ideas||[]) as VotingIdea[];
  setIdeas(queue);
  const next=queue.findIndex(idea=>!idea.my_ratings);
  if(next<0&&queue.length>0){setCompleted(true);setIndex(queue.length-1)}else{setCompleted(false);setIndex(Math.max(0,next))}
  setLoading(false);
 };

 useEffect(()=>{void load()},[session.id,participant.id]);
 useEffect(()=>{setRatings(current?.my_ratings||{});setError('');if(typeof window!=='undefined'&&window.innerWidth<768)setDetailsOpen(false)},[current?.id]);

 const matchesAllCriteria=useMemo(()=>CRITERIA.every(([key])=>Number(ratings[key])>=1&&Number(ratings[key])<=5),[ratings]);
 const submit=async()=>{
  if(!current||!matchesAllCriteria)return;
  setBusy(true);setError('');
  if(!configured){setBusy(false);return}
  const {error}=await supabase.rpc('brainstorm_submit_vote',{p_session_id:session.id,p_idea_id:current.id,p_participant_id:participant.id,p_token:participant.anonymous_token,p_ratings:ratings});
  if(error){setError(online?'Não foi possível salvar sua avaliação. Tente novamente.':'Você está sem conexão. Reconecte-se antes de continuar.');setBusy(false);return}
  const saved=ratings as Ratings;
  const updated=ideas.map((idea,position)=>position===index?{...idea,my_ratings:saved}:idea);
  setIdeas(updated);
  const next=updated.findIndex((idea,position)=>position>index&&!idea.my_ratings);
  const fallback=updated.findIndex(idea=>!idea.my_ratings);
  if(next>=0)setIndex(next);
  else if(fallback>=0)setIndex(fallback);
  else setCompleted(true);
  setBusy(false);
  window.scrollTo({top:0,behavior:'smooth'});
 };
 const navigate=(position:number)=>{if(position<0||position>=ideas.length)return;setCompleted(false);setIndex(position);window.scrollTo({top:0,behavior:'smooth'})};

 if(loading)return <Chrome online={online}><div className="card mx-auto max-w-xl text-center"><Clock3 className="mx-auto text-brand-600" size={42}/><h1 className="mt-4 text-2xl font-black">Preparando sua votação…</h1><p className="mt-2 text-slate-600">Buscando seu progresso salvo.</p></div></Chrome>;
 if(error&&!ideas.length)return <Chrome online={online}><div className="card mx-auto max-w-xl text-center"><AlertCircle className="mx-auto text-red-600" size={42}/><h1 className="mt-4 text-2xl font-black">Não foi possível abrir a votação</h1><p className="mt-2 text-slate-600">{error}</p><button className="btn-primary mt-5" onClick={load}>Tentar novamente</button></div></Chrome>;
 if(completed)return <Chrome online={online}><div className="card mx-auto max-w-xl text-center"><CheckCircle2 className="mx-auto text-brand-600" size={56}/><p className="mt-4 font-semibold text-brand-700">{ideas.length} de {ideas.length}</p><h1 className="mt-2 text-3xl font-black">Votação concluída</h1><p className="mt-3 text-slate-600">Todas as suas avaliações foram salvas. Você pode fechar esta página ou revisar suas notas enquanto a votação estiver aberta.</p><button className="btn-secondary mt-6 w-full" onClick={()=>navigate(0)}><RotateCcw className="mr-2" size={18}/>Revisar avaliações</button></div></Chrome>;
 if(!current)return <Chrome online={online}><div className="card mx-auto max-w-xl text-center"><h1 className="text-2xl font-black">Nenhuma ideia disponível</h1><p className="mt-2 text-slate-600">O facilitador ainda está preparando a fila.</p></div></Chrome>;

 return <Chrome online={online} compact><div className="mx-auto max-w-3xl pb-28 sm:pb-0">
  <div className="flex items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Ideia {index+1} de {ideas.length}</p><p className="mt-0.5 text-sm text-slate-500">{votedCount} avaliadas · {remaining} restantes</p></div><span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{percentage}%</span></div>
  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600 transition-all" style={{width:`${percentage}%`}}/></div>
  <div className="mt-4 hidden gap-1 overflow-x-auto pb-2 sm:flex" aria-label="Navegação pelas ideias">{ideas.map((idea,position)=><button aria-label={`Ir para ideia ${position+1}${idea.my_ratings?', já avaliada':''}`} className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${position===index?'bg-slate-900 text-white':idea.my_ratings?'bg-brand-100 text-brand-700':'bg-slate-200 text-slate-600'}`} onClick={()=>navigate(position)} key={idea.id}>{idea.my_ratings?<Check size={14}/>:position+1}</button>)}</div>
  <article className="mt-5 sm:mt-6"><p className="font-semibold text-brand-700">{current.area_name}</p><h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{current.title}</h1>{current.description&&<p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">{current.description}</p>}</article>
  <details className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-sm sm:mt-6 sm:p-5" open={detailsOpen} onToggle={event=>setDetailsOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-bold text-brand-700">Entenda o agrupamento · {current.source_count||current.source_ideas?.length||0} contribuições</summary><p className="mt-3 text-sm text-brand-900">Estas contribuições foram unidas porque apresentam soluções iguais ou complementares para o mesmo objetivo.</p><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{(current.source_ideas||[]).map((source,position)=><article className="rounded-xl bg-white p-3 sm:p-4" key={source.id}><p className="text-xs font-bold text-slate-500">{position+1}. {source.question}</p><p className="mt-1 text-sm text-slate-800">{source.text}</p>{source.expected_result&&<p className="mt-2 text-xs text-slate-600"><strong>Resultado esperado:</strong> {source.expected_result}</p>}</article>)}</div></details>
  <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white"><span className="font-semibold">{answeredCount} de {CRITERIA.length} critérios</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${matchesAllCriteria?'bg-brand-500 text-white':'bg-white/10 text-slate-200'}`}>{matchesAllCriteria?'Pronto para salvar':`Faltam ${CRITERIA.length-answeredCount}`}</span></div>
  <p className="mt-4 text-sm font-semibold text-slate-700">Avalie de 1 (muito baixo) a 5 (muito alto).</p>
  <div className="mt-3 space-y-3 sm:space-y-4">{CRITERIA.map(([key,label,question])=><fieldset className={`rounded-2xl border bg-white p-3 shadow-sm transition sm:p-5 ${ratings[key]?'border-brand-500 ring-1 ring-brand-100':'border-slate-200'}`} key={key}><legend className="px-1 font-bold">{label}</legend><p className="mt-1 text-sm leading-snug text-slate-600">{question}</p><div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">{[1,2,3,4,5].map(value=><button type="button" aria-label={`${label}: ${value}`} aria-pressed={ratings[key]===value} className={`min-h-12 rounded-xl text-base font-black transition active:scale-95 ${ratings[key]===value?'bg-brand-600 text-white shadow-sm ring-2 ring-brand-100':'bg-slate-100 text-slate-800 hover:bg-slate-200'}`} onClick={()=>setRatings(currentRatings=>({...currentRatings,[key]:value}))} key={value}>{value}</button>)}</div><div className="mt-1.5 flex justify-between px-1 text-[11px] font-medium text-slate-400"><span>Muito baixo</span><span>Muito alto</span></div></fieldset>)}</div>
  {error&&<div role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800"><AlertCircle className="shrink-0" size={18}/>{error}</div>}
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
   <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr] gap-2 sm:gap-3"><button className="btn-secondary px-3 sm:px-5" aria-label="Voltar para a ideia anterior" disabled={busy||index===0} onClick={()=>navigate(index-1)}><ArrowLeft className="sm:mr-2" size={18}/><span className="hidden sm:inline">Anterior</span></button><button className="btn-primary px-3 sm:px-5" disabled={busy||!matchesAllCriteria} onClick={submit}>{busy?'Salvando…':matchesAllCriteria?current.my_ratings?'Atualizar e avançar':isLastIdea?'Concluir votação':`Salvar e ir para a ideia ${index+2}`:`Responda os ${CRITERIA.length-answeredCount} restantes`}</button></div>
  </div>
 </div></Chrome>
}
