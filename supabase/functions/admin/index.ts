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
    if(action==='get_workspace'){
      const [areas,rounds,ideas,groups,sources,participants]=await Promise.all([
        db.from('brainstorm_areas').select('id,name,slug,display_order').eq('active',true).order('display_order'),
        db.from('brainstorm_rounds').select('id,area_id,title,question,pillar,topic,display_order').eq('session_id',session.id).order('display_order'),
        db.from('brainstorm_ideas').select('id,round_id,area_id,participant_id,text,expected_result,created_at').eq('session_id',session.id).order('created_at'),
        db.from('brainstorm_consolidated_ideas').select('*').eq('session_id',session.id).order('display_order'),
        db.from('brainstorm_consolidated_idea_sources').select('consolidated_idea_id,idea_id'),
        db.from('brainstorm_participants').select('id,primary_area_id,last_seen_at').eq('session_id',session.id)
      ]);
      const failed=[areas,rounds,ideas,groups,sources,participants].find(result=>result.error);
      if(failed?.error)throw failed.error;
      const ideaIds=new Set((ideas.data||[]).map(item=>item.id));
      return json({
        session,
        areas:areas.data||[],rounds:rounds.data||[],ideas:ideas.data||[],groups:groups.data||[],
        sources:(sources.data||[]).filter(source=>ideaIds.has(source.idea_id)),
        participants:participants.data||[]
      });
    }else if(action==='create_group'){
      const {data,error}=await db.rpc('brainstorm_admin_create_group',{
        p_session_id:session.id,p_area_id:String(payload.area_id||''),p_title:String(payload.title||''),
        p_description:String(payload.description||''),p_idea_ids:Array.isArray(payload.idea_ids)?payload.idea_ids:[]
      });
      if(error)throw error;
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload:{...payload,group_id:data.id}});
      return json({group:data});
    }else if(['update_group','set_group_sources','delete_group'].includes(action)){
      const groupId=String(payload.group_id||'');
      const {data:owned}=await db.from('brainstorm_consolidated_ideas').select('id').eq('id',groupId).eq('session_id',session.id).maybeSingle();
      if(!owned)return json({error:'Ideia consolidada não encontrada nesta sessão'},404);
      if(action==='update_group'){
        const {data,error}=await db.rpc('brainstorm_admin_update_group',{
          p_group_id:groupId,p_title:String(payload.title||''),p_description:String(payload.description||''),p_approved:Boolean(payload.approved)
        });
        if(error)throw error;
        await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
        return json({group:data});
      }
      if(action==='set_group_sources'){
        const {data,error}=await db.rpc('brainstorm_admin_set_group_sources',{
          p_group_id:groupId,p_idea_ids:Array.isArray(payload.idea_ids)?payload.idea_ids:[]
        });
        if(error)throw error;
        await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
        return json({source_count:data});
      }
      const {data,error}=await db.rpc('brainstorm_admin_delete_group',{p_group_id:groupId});
      if(error)throw error;
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
      return json({deleted:data});
    }else if(action==='reorder_groups'){
      const {data,error}=await db.rpc('brainstorm_admin_reorder_groups',{
        p_session_id:session.id,p_group_ids:Array.isArray(payload.group_ids)?payload.group_ids:[]
      });
      if(error)throw error;
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
      return json({updated:data});
    }else if(action==='select_current_idea'){
      const {data,error}=await db.rpc('brainstorm_admin_select_current_idea',{
        p_session_id:session.id,p_group_id:String(payload.group_id||'')
      });
      if(error)throw error;
      await db.from('brainstorm_admin_audit_log').insert({session_id:session.id,action,payload});
      return json({current_idea_id:data});
    }else if(action==='voting_progress'){
      const {data,error}=await db.rpc('brainstorm_admin_voting_progress',{p_session_id:session.id});
      if(error)throw error;
      return json({progress:data});
    }else if(action==='set_status'){
      const target=String(payload.status||'');
      if(!transitions[session.status]?.includes(target))return json({error:`Transição inválida: ${session.status} → ${target}`},409);
      if(target==='VOTING_OPEN'){
        if(!session.current_consolidated_idea_id)return json({error:'Selecione uma ideia aprovada antes de abrir a votação.'},409);
        const {data:selected}=await db.from('brainstorm_consolidated_ideas').select('id').eq('id',session.current_consolidated_idea_id).eq('session_id',session.id).eq('approved',true).maybeSingle();
        if(!selected)return json({error:'A ideia selecionada não está aprovada.'},409);
      }
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
