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
 const current=ideas[index];
 const votedCount=ideas.filter(idea=>idea.my_ratings).length;
 const percentage=ideas.length?Math.round(votedCount/ideas.length*100):0;
 const remaining=ideas.length-votedCount;

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
 useEffect(()=>{setRatings(current?.my_ratings||{});setError('')},[current?.id]);

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

 return <Chrome online={online}><div className="mx-auto max-w-3xl">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Ideia {index+1} de {ideas.length}</p><p className="mt-1 text-sm text-slate-500">{votedCount} avaliadas · {remaining} restantes</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{percentage}% concluído</span></div>
  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600 transition-all" style={{width:`${percentage}%`}}/></div>
  <div className="mt-4 flex gap-1 overflow-x-auto pb-2" aria-label="Navegação pelas ideias">{ideas.map((idea,position)=><button aria-label={`Ir para ideia ${position+1}${idea.my_ratings?', já avaliada':''}`} className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${position===index?'bg-slate-900 text-white':idea.my_ratings?'bg-brand-100 text-brand-700':'bg-slate-200 text-slate-600'}`} onClick={()=>navigate(position)} key={idea.id}>{idea.my_ratings?<Check size={14}/>:position+1}</button>)}</div>
  <article className="mt-6"><p className="font-semibold text-brand-700">{current.area_name}</p><h1 className="mt-1 text-3xl font-black">{current.title}</h1>{current.description&&<p className="mt-3 text-lg leading-relaxed text-slate-600">{current.description}</p>}</article>
  <details className="card mt-6 border-brand-200 bg-brand-50" open><summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-brand-700">Como este agrupamento foi formado</summary><p className="mt-2 text-sm text-brand-900">Esta iniciativa reúne {current.source_count||current.source_ideas?.length||0} contribuição(ões) com soluções iguais ou complementares para o mesmo objetivo.</p><div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{(current.source_ideas||[]).map((source,position)=><article className="rounded-xl bg-white p-4" key={source.id}><p className="text-xs font-bold text-slate-500">{position+1}. {source.question}</p><p className="mt-1 text-sm text-slate-800">{source.text}</p>{source.expected_result&&<p className="mt-2 text-xs text-slate-600"><strong>Resultado esperado:</strong> {source.expected_result}</p>}</article>)}</div></details>
  <p className="mt-5 rounded-xl bg-slate-900 p-3 text-center text-sm font-semibold text-white">Critérios respondidos: {CRITERIA.filter(([key])=>ratings[key]).length} de {CRITERIA.length}</p>
  <div className="mt-5 space-y-4">{CRITERIA.map(([key,label,question])=><fieldset className="card" key={key}><legend className="font-bold">{label}</legend><p className="mt-1 text-sm text-slate-600">{question}</p><div className="mt-4 grid grid-cols-5 gap-2">{[1,2,3,4,5].map(value=><button type="button" aria-label={`${label}: ${value}`} className={`min-h-12 rounded-xl font-bold ${ratings[key]===value?'bg-brand-600 text-white':'bg-slate-100'}`} onClick={()=>setRatings(currentRatings=>({...currentRatings,[key]:value}))} key={value}>{value}</button>)}</div></fieldset>)}</div>
  <p className="mt-4 text-center text-xs text-slate-500">1 = muito baixo · 3 = médio · 5 = muito alto</p>
  {error&&<div role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800"><AlertCircle className="shrink-0" size={18}/>{error}</div>}
  <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]"><button className="btn-secondary" disabled={busy||index===0} onClick={()=>navigate(index-1)}><ArrowLeft className="mr-2" size={18}/>Anterior</button><button className="btn-primary" disabled={busy||!matchesAllCriteria} onClick={submit}>{busy?'Salvando…':current.my_ratings?'Atualizar e avançar':'Salvar e avançar'}</button></div>
 </div></Chrome>
}
