import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const transitions:Record<string,string[]>={WAITING:['AI_GROUPING'],PRESENTING:['IDEATION_OPEN','WAITING'],IDEATION_OPEN:['AI_GROUPING'],IDEATION_CLOSED:['AI_GROUPING'],AI_GROUPING:['GROUP_REVIEW'],GROUP_REVIEW:['VOTING_OPEN'],VOTING_OPEN:['VOTING_WAITING'],VOTING_WAITING:['VOTING_OPEN','RESULTS'],RESULTS:['WAITING','FINISHED'],FINISHED:[]};
const encoder=new TextEncoder();
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const body=await req.json();
    const {action,payload={}}=body;
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
    if(!secret)throw new Error('Chave administrativa indisponível');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,secret);

    if(action==='authenticate'){
      const code=String(body.session_code||'').toUpperCase();
      const pin=String(body.pin||'');
      const client=await hash(`${req.headers.get('x-forwarded-for')||'unknown'}:${code}`);
      const {data:session}=await db.from('brainstorm_sessions').select('id,code,title').eq('code',code).maybeSingle();
      if(!session)return json({error:'Sessão não encontrada'},404);
      const since=new Date(Date.now()-10*60_000).toISOString();
      const {count}=await db.from('brainstorm_admin_login_attempts').select('*',{count:'exact',head:true}).eq('client_hash',client).eq('success',false).gte('created_at',since);
      if((count||0)>=5)return json({error:'Muitas tentativas. Aguarde 10 minutos.'},429);
      const {data:valid}=await db.rpc('brainstorm_verify_admin_pin',{p_code:code,p_pin:pin});
      await db.from('brainstorm_admin_login_attempts').insert({session_id:session.id,client_hash:client,success:Boolean(valid)});
      if(!valid)return json({error:'PIN inválido'},403);
      const token=`${crypto.randomUUID()}.${crypto.randomUUID()}`;
      const expiresAt=new Date(Date.now()+8*60*60_000).toISOString();
      await db.from('brainstorm_admin_sessions').insert({session_id:session.id,token_hash:await hash(token),expires_at:expiresAt});
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action:'authenticate'});
      return json({admin_token:token,expires_at:expiresAt,session:{code:session.code,title:session.title}});
    }

    const token=String(body.admin_token||'');
    if(!token)return json({error:'Autenticação administrativa necessária'},401);
    const tokenHash=await hash(token);
    const {data:admin}=await db.from('brainstorm_admin_sessions').select('id,session_id,expires_at,revoked_at').eq('token_hash',tokenHash).gt('expires_at',new Date().toISOString()).is('revoked_at',null).maybeSingle();
    if(!admin)return json({error:'Sessão administrativa expirada'},401);
    const {data:session}=await db.from('brainstorm_sessions').select('*').eq('id',admin.session_id).single();
    await db.from('brainstorm_admin_sessions').update({last_used_at:new Date().toISOString()}).eq('id',admin.id);

    if(action==='logout'){
      await db.from('brainstorm_admin_sessions').update({revoked_at:new Date().toISOString()}).eq('id',admin.id);
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action:'logout'});
      return json({ok:true});
    }
    if(action==='set_status'){
      const target=String(payload.status||'');
      if(!transitions[session.status]?.includes(target))return json({error:`Transição inválida: ${session.status} → ${target}`},409);
      await db.from('brainstorm_sessions').update({status:target,stage_started_at:new Date().toISOString(),stage_ends_at:null}).eq('id',session.id);
    }else if(action==='return_to_waiting'){
      await db.from('brainstorm_sessions').update({status:'WAITING',stage_started_at:new Date().toISOString(),stage_ends_at:null,current_consolidated_idea_id:null}).eq('id',session.id);
    }else if(action==='add_time'){
      if(session.status!=='IDEATION_OPEN')return json({error:'O cronômetro só pode ser alterado com contribuições abertas.'},409);
      const seconds=Math.min(120,Math.max(1,Number(payload.seconds)));
      const base=session.stage_ends_at?new Date(session.stage_ends_at).getTime():Date.now();
      await db.from('brainstorm_sessions').update({stage_ends_at:new Date(base+seconds*1000).toISOString()}).eq('id',session.id);
    }else return json({error:'Ação inválida'},400);

    await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
    return json({ok:true});
  }catch(error){return json({error:error instanceof Error?error.message:'Erro inesperado'},400)}
});
