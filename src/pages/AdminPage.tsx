import {FormEvent,useState} from 'react';
import {Chrome} from '../components/Chrome';
import {SessionStatus} from '../types';
import {configured,supabase} from '../lib/supabase';
import {setDemoStatus} from '../lib/demo';

const actions:[string,SessionStatus][]=[['Iniciar agrupamento','AI_GROUPING'],['Ir para revisão','GROUP_REVIEW'],['Abrir votação','VOTING_OPEN'],['Encerrar votação','VOTING_WAITING'],['Publicar resultados','RESULTS'],['Finalizar evento','FINISHED']];
const tokenKey=(code:string)=>`brainstorm:${code}:admin-token`;

export default function AdminPage(){
 const [pin,setPin]=useState('');
 const [code,setCode]=useState('ALPHA2026');
 const [adminToken,setAdminToken]=useState(()=>sessionStorage.getItem(tokenKey('ALPHA2026'))||'');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);

 const authenticate=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setMessage('Validando…');
  if(!configured){setAdminToken('demo');setMessage('');setBusy(false);return}
  const {data,error}=await supabase.functions.invoke('brainstorm-admin',{body:{action:'authenticate',session_code:code,pin}});
  if(error||!data?.admin_token){setMessage(data?.error||'PIN inválido ou serviço indisponível.');setBusy(false);return}
  sessionStorage.setItem(tokenKey(code),data.admin_token);setAdminToken(data.admin_token);setPin('');setMessage('');setBusy(false);
 };
 const invoke=async(action:string,payload:Record<string,unknown>={})=>{
  setBusy(true);setMessage('Salvando…');
  if(!configured){if(action==='set_status')setDemoStatus(payload.status as SessionStatus);setMessage('Modo demo atualizado.');setBusy(false);return}
  const {data,error}=await supabase.functions.invoke('brainstorm-admin',{body:{admin_token:adminToken,action,payload}});
  if(error||data?.error){const text=data?.error||'Não foi possível concluir a ação.';setMessage(text);if(text.toLowerCase().includes('expirada')||text.toLowerCase().includes('autenticação')){sessionStorage.removeItem(tokenKey(code));setAdminToken('')}}else setMessage('Atualizado para todos os participantes.');
  setBusy(false);
 };
 const logout=async()=>{if(configured&&adminToken)await supabase.functions.invoke('brainstorm-admin',{body:{admin_token:adminToken,action:'logout'}});sessionStorage.removeItem(tokenKey(code));setAdminToken('');setMessage('')};

 if(!adminToken)return <Chrome><form className="card mx-auto max-w-sm" onSubmit={authenticate}><h1 className="text-2xl font-black">Painel do facilitador</h1>{!configured&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Modo demonstração local — use qualquer PIN.</p>}<label className="mt-6 block"><span className="label">Código da sessão</span><input className="field" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><label className="mt-4 block"><span className="label">PIN</span><input className="field" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}/></label>{message&&<p role="alert" className="mt-3 text-sm font-medium text-red-700">{message}</p>}<button disabled={busy||!pin} className="btn-primary mt-5 w-full">{busy?'Validando…':'Entrar'}</button></form></Chrome>;
 return <Chrome><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Sessão {code}</p><h1 className="text-3xl font-black">Controle do evento</h1></div><button className="btn-secondary" onClick={logout}>Sair com segurança</button></div><section className="card mt-6"><h2 className="text-lg font-bold">Fluxo da sessão</h2><p className="mt-1 text-sm text-slate-600">O servidor bloqueia transições fora da ordem do evento.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actions.map(([label,status])=><button disabled={busy} className="btn-secondary justify-start" key={status} onClick={()=>(status!=='FINISHED'||confirm('Finalizar o evento? Esta ação encerra o fluxo de participantes.'))?invoke('set_status',{status}):undefined}>{label}</button>)}</div><button disabled={busy} className="btn-secondary mt-3 text-red-700" onClick={()=>confirm('Voltar todos para a sala de espera?')&&invoke('return_to_waiting')}>Voltar à sala de espera</button>{message&&<p role="status" className="mt-4 text-sm font-medium text-brand-700">{message}</p>}</section></Chrome>;
}
