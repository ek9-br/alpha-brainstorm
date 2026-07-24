import {KeyboardEvent,PointerEvent,useEffect,useMemo,useRef,useState,WheelEvent} from 'react';
import {LocateFixed,Maximize2,Minimize2,Network,Search,X,ZoomIn,ZoomOut} from 'lucide-react';
import {AdminWorkspace} from './AdminGrouping';

type ViewBox={x:number;y:number;width:number;height:number};
type Contribution=AdminWorkspace['ideas'][number];
type Group=AdminWorkspace['groups'][number];
type MapIdea=Contribution&{x:number;y:number;searchText:string};
type MapGroup={key:string;group:Group;x:number;y:number;startY:number;endY:number;ideas:MapIdea[];searchText:string};
type MapPillar={key:string;name:string;x:number;y:number;startY:number;endY:number;groups:MapGroup[]};
type MapArea=AdminWorkspace['areas'][number]&{x:number;y:number;color:string;softColor:string;startY:number;endY:number;pillars:MapPillar[];groupCount:number;ideaCount:number};
type SearchMatch={key:string;kind:'group'|'idea';group:MapGroup;idea?:MapIdea};

const CANVAS_WIDTH=2260;
const PILLAR_ORDER=['Crescimento','Redução de custos','Otimização','Pergunta aberta','Sem pilar'];
const COLORS=[
 {color:'#0f7464',softColor:'#d5f2eb'},
 {color:'#2563eb',softColor:'#dbeafe'},
 {color:'#7c3aed',softColor:'#ede9fe'},
 {color:'#d97706',softColor:'#fef3c7'},
 {color:'#dc2626',softColor:'#fee2e2'}
];

export function AdminMindMap({workspace}:{workspace:AdminWorkspace}){
 const compact=typeof window!=='undefined'&&window.innerWidth<640;
 const [query,setQuery]=useState('');
 const [matchIndex,setMatchIndex]=useState(-1);
 const [fullscreen,setFullscreen]=useState(false);
 const [selectedGroupKey,setSelectedGroupKey]=useState<string|null>(null);
 const [selectedIdeaId,setSelectedIdeaId]=useState<string|null>(null);
 const [navigationAreaId,setNavigationAreaId]=useState(workspace.areas[0]?.id||'');
 const panStart=useRef<{clientX:number;clientY:number;viewX:number;viewY:number}|null>(null);
 const roundsById=useMemo(()=>new Map(workspace.rounds.map(round=>[round.id,round])),[workspace.rounds]);
 const ideasById=useMemo(()=>new Map(workspace.ideas.map(idea=>[idea.id,idea])),[workspace.ideas]);
 const sourceIdsByGroup=useMemo(()=>{const result=new Map<string,string[]>();workspace.sources.forEach(source=>result.set(source.consolidated_idea_id,[...(result.get(source.consolidated_idea_id)||[]),source.idea_id]));return result},[workspace.sources]);

 const layout=useMemo(()=>{
  let cursorY=90;
  const approved=[...workspace.groups].filter(group=>group.approved).sort((a,b)=>a.display_order-b.display_order);
  const areas:MapArea[]=workspace.areas.map((area,areaIndex)=>{
   const areaGroups=approved.filter(group=>group.area_id===area.id);
   const pillarNames=[...new Set(areaGroups.flatMap(group=>(sourceIdsByGroup.get(group.id)||[]).map(id=>ideasById.get(id)).filter(Boolean).map(idea=>roundsById.get(idea!.round_id)?.pillar?.trim()||'Sem pilar')))]
    .sort((a,b)=>pillarRank(a)-pillarRank(b)||a.localeCompare(b));
   const areaStart=cursorY;
   const pillars:MapPillar[]=pillarNames.map(pillarName=>{
    const pillarStart=cursorY;
    const groups:MapGroup[]=areaGroups.flatMap(group=>{
     const ideas=(sourceIdsByGroup.get(group.id)||[]).map(id=>ideasById.get(id)).filter((idea):idea is Contribution=>Boolean(idea)&&(roundsById.get(idea!.round_id)?.pillar?.trim()||'Sem pilar')===pillarName);
     if(!ideas.length)return[];
     const groupStart=cursorY;
     const mappedIdeas=ideas.map(idea=>{const mapped={...idea,x:1480,y:cursorY,searchText:`${idea.text} ${idea.expected_result||''} ${roundsById.get(idea.round_id)?.title||''}`.toLowerCase()};cursorY+=76;return mapped});
     const groupEnd=cursorY-76;
     const mapped:MapGroup={key:`${group.id}:${pillarName}`,group,x:980,y:(groupStart+groupEnd)/2,startY:groupStart,endY:groupEnd,ideas:mappedIdeas,searchText:`${group.title} ${group.description} ${mappedIdeas.map(idea=>idea.searchText).join(' ')}`.toLowerCase()};
     cursorY+=28;
     return[mapped];
    });
    const pillarEnd=Math.max(pillarStart,cursorY-28);
    const mapped={key:`${area.id}:${pillarName}`,name:pillarName,x:650,y:(pillarStart+pillarEnd)/2,startY:pillarStart,endY:pillarEnd,groups};
    cursorY+=48;
    return mapped;
   });
   const areaEnd=Math.max(areaStart,cursorY-48);
   const mapped={...area,x:340,y:(areaStart+areaEnd)/2,color:COLORS[areaIndex%COLORS.length].color,softColor:COLORS[areaIndex%COLORS.length].softColor,startY:areaStart,endY:areaEnd,pillars,groupCount:areaGroups.length,ideaCount:pillars.reduce((sum,pillar)=>sum+pillar.groups.reduce((total,group)=>total+group.ideas.length,0),0)};
   cursorY+=90;
   return mapped;
  });
  return {areas,height:Math.max(1000,cursorY),groupCount:approved.length,ideaCount:workspace.sources.filter(source=>approved.some(group=>group.id===source.consolidated_idea_id)).length};
 },[workspace.areas,workspace.groups,workspace.sources,sourceIdsByGroup,ideasById,roundsById]);

 const allGroups=useMemo(()=>layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups)),[layout]);
 const navigationArea=layout.areas.find(area=>area.id===navigationAreaId)||layout.areas[0];
 const [view,setView]=useState<ViewBox>(compact?{x:600,y:20,width:980,height:1180}:{x:230,y:20,width:1960,height:980});
 const normalized=query.trim().toLowerCase();
 const matches=useMemo<SearchMatch[]>(()=>allGroups.flatMap(group=>{
  const result:SearchMatch[]=[];
  if(normalized&&`${group.group.title} ${group.group.description}`.toLowerCase().includes(normalized))result.push({key:`group:${group.key}`,kind:'group',group});
  group.ideas.filter(idea=>normalized&&idea.searchText.includes(normalized)).forEach(idea=>result.push({key:`idea:${idea.id}`,kind:'idea',group,idea}));
  return result;
 }),[allGroups,normalized]);
 const selectedGroup=allGroups.find(group=>group.key===selectedGroupKey)||null;
 const selectedIdea=selectedGroup?.ideas.find(idea=>idea.id===selectedIdeaId)||null;
 const selectedArea=selectedGroup?layout.areas.find(area=>area.id===selectedGroup.group.area_id):null;
 const selectedPillar=selectedGroup?selectedGroup.key.slice(selectedGroup.group.id.length+1):null;
 const groupPillarCount=selectedGroup?new Set(allGroups.filter(group=>group.group.id===selectedGroup.group.id).map(group=>group.key.slice(group.group.id.length+1))).size:0;
 const rootY=layout.height/2;

 const clamp=(next:ViewBox):ViewBox=>({...next,x:Math.max(-120,Math.min(CANVAS_WIDTH-next.width+120,next.x)),y:Math.max(-120,Math.min(layout.height-next.height+120,next.y))});
 const zoom=(factor:number)=>setView(current=>{const width=Math.max(620,Math.min(CANVAS_WIDTH*1.06,current.width*factor));const height=width*(current.height/current.width);return clamp({x:current.x+(current.width-width)/2,y:current.y+(current.height-height)/2,width,height})});
 const fitAll=()=>setView({x:0,y:0,width:CANVAS_WIDTH,height:layout.height});
 const focusArea=(area:MapArea)=>{setNavigationAreaId(area.id);setView(clamp(compact?{x:300,y:area.startY-80,width:1220,height:1180}:{x:250,y:area.startY-80,width:1900,height:Math.max(620,Math.min(1100,area.endY-area.startY+180))}))};
 const focusPillar=(pillar:MapPillar)=>{setNavigationAreaId(pillar.key.slice(0,pillar.key.indexOf(':')));setView(clamp(compact?{x:560,y:pillar.startY-80,width:1100,height:1050}:{x:560,y:pillar.startY-80,width:1580,height:Math.max(600,Math.min(1000,pillar.endY-pillar.startY+180))}))};
 const focusGroup=(group:MapGroup)=>{setSelectedGroupKey(group.key);setSelectedIdeaId(null);setView(clamp(compact?{x:880,y:group.y-450,width:1050,height:900}:{x:830,y:group.y-300,width:1370,height:650}))};
 const focusIdea=(group:MapGroup,idea:MapIdea)=>{setSelectedGroupKey(group.key);setSelectedIdeaId(idea.id);setView(clamp(compact?{x:1300,y:idea.y-380,width:900,height:760}:{x:1260,y:idea.y-250,width:920,height:520}))};
 const nextMatch=()=>{if(!matches.length)return;const index=(matchIndex+1)%matches.length;const match=matches[index];setMatchIndex(index);match.kind==='idea'&&match.idea?focusIdea(match.group,match.idea):focusGroup(match.group)};
 const handleSearch=(value:string)=>{setQuery(value);setMatchIndex(-1)};
 const activate=(event:KeyboardEvent<SVGGElement>,action:()=>void)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action()}};
 const startPan=(event:PointerEvent<SVGSVGElement>)=>{if((event.target as Element).closest('[data-map-node]'))return;event.currentTarget.setPointerCapture(event.pointerId);panStart.current={clientX:event.clientX,clientY:event.clientY,viewX:view.x,viewY:view.y}};
 const movePan=(event:PointerEvent<SVGSVGElement>)=>{if(!panStart.current)return;const bounds=event.currentTarget.getBoundingClientRect();const dx=(event.clientX-panStart.current.clientX)*view.width/bounds.width;const dy=(event.clientY-panStart.current.clientY)*view.height/bounds.height;setView(current=>clamp({...current,x:panStart.current!.viewX-dx,y:panStart.current!.viewY-dy}))};
 const endPan=()=>{panStart.current=null};
 const handleWheel=(event:WheelEvent<SVGSVGElement>)=>{event.preventDefault();zoom(event.deltaY>0?1.12:.88)};
 useEffect(()=>{if(selectedGroupKey||!workspace.session.current_consolidated_idea_id)return;const first=allGroups.find(group=>group.group.id===workspace.session.current_consolidated_idea_id);if(first)setSelectedGroupKey(first.key)},[allGroups,selectedGroupKey,workspace.session.current_consolidated_idea_id]);
 useEffect(()=>{if(!fullscreen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setFullscreen(false)};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close)}},[fullscreen]);

 if(layout.groupCount===0)return null;
 const details=selectedGroup?<div>
  <button aria-label="Fechar detalhes" className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={()=>{setSelectedGroupKey(null);setSelectedIdeaId(null)}}><X size={18}/></button>
  <p className="pr-10 text-sm font-bold text-brand-700">{selectedArea?.name} → {selectedPillar}</p>
  <h3 className="mt-1 pr-10 text-xl font-black">{selectedIdea?'Ideia original':selectedGroup.group.title}</h3>
  {selectedIdea?<><p className="mt-3 text-sm">{selectedIdea.text}</p>{selectedIdea.expected_result&&<p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900"><strong>Resultado esperado:</strong> {selectedIdea.expected_result}</p>}<p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Pergunta de origem</p><p className="mt-1 text-sm font-semibold">{roundsById.get(selectedIdea.round_id)?.title}</p><p className="mt-1 text-sm text-slate-600">{roundsById.get(selectedIdea.round_id)?.question}</p><button className="btn-secondary mt-4 w-full" onClick={()=>setSelectedIdeaId(null)}>Voltar ao grupo</button></>:<>
   <p className="mt-2 text-sm text-slate-600">{selectedGroup.group.description}</p>
   <p className="mt-4 text-sm font-bold">{selectedGroup.ideas.length} ideia(s) neste pilar</p>
   {groupPillarCount>1&&<p className="mt-1 text-xs text-slate-500">Este grupo reúne ideias de {groupPillarCount} pilares e aparece em cada ramo com as respostas correspondentes.</p>}
   <div className="mt-3 space-y-2">{selectedGroup.ideas.map((idea,index)=><button className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-400 hover:bg-brand-50" onClick={()=>focusIdea(selectedGroup,idea)} key={idea.id}><span className="text-xs font-bold text-slate-500">{index+1}. {roundsById.get(idea.round_id)?.title}</span><span className="mt-1 block text-sm">{idea.text}</span></button>)}</div>
  </>}
 </div>:null;

 return <section className="mt-8">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Visão geral</p><h2 className="flex items-center gap-2 text-2xl font-black"><Network/>Mapa mental da votação</h2><p className="mt-1 text-sm text-slate-600">Hierarquia completa: setor, pilar, grupo consolidado e ideias originais.</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{layout.groupCount} grupos · {layout.ideaCount} ideias</span></div>
  <div className={fullscreen?'fixed inset-0 z-[100] flex flex-col bg-white p-3 sm:p-5':'card mt-5 p-3 sm:p-5'}>
   <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2">{layout.areas.map(area=><button className={`min-h-10 rounded-xl border px-3 text-sm font-bold transition hover:-translate-y-0.5 ${navigationArea?.id===area.id?'ring-2 ring-offset-2':''}`} style={{borderColor:area.color,color:area.color,backgroundColor:area.softColor}} onClick={()=>focusArea(area)} key={area.id}>{area.name} · {area.groupCount} grupos</button>)}<button className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold" onClick={fitAll}><Maximize2 className="mr-1 inline" size={15}/>Ver tudo</button></div><button className="btn-secondary shrink-0" onClick={()=>setFullscreen(value=>!value)}>{fullscreen?<><Minimize2 className="mr-2" size={18}/>Sair da tela cheia</>:<><Maximize2 className="mr-2" size={18}/>Abrir em tela cheia</>}</button></div>
   {navigationArea&&<div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Pilares de {navigationArea.name}</span>{navigationArea.pillars.map(pillar=><button className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-slate-50" style={{borderColor:navigationArea.color,color:navigationArea.color}} onClick={()=>focusPillar(pillar)} key={pillar.key}>{pillar.name} · {pillar.groups.length}</button>)}</div>}
   <div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-64 flex-1"><span className="label">Buscar grupo ou ideia original</span><span className="relative block"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input className="field pl-10" value={query} onChange={event=>handleSearch(event.target.value)} onKeyDown={event=>event.key==='Enter'&&nextMatch()} placeholder="Ex.: CRM, documentos, parceiros"/></span></label><button className="btn-secondary" disabled={!normalized||matches.length===0} onClick={nextMatch}><LocateFixed className="mr-2" size={17}/>{normalized?`${matches.length} resultado(s)`:'Localizar'}</button><div className="flex gap-1"><button aria-label="Aumentar mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(.82)}><ZoomIn size={19}/></button><button aria-label="Diminuir mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(1.2)}><ZoomOut size={19}/></button></div></div>
   <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-900 px-3 py-1 text-white">Setor</span><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Pilar</span><span className="rounded-full border border-slate-400 bg-white px-3 py-1">Grupo</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Ideia original</span></div>
   <p className="mt-2 text-xs text-slate-500">Arraste espaços vazios, use a roda para ampliar e clique em qualquer setor, pilar, grupo ou ideia. Pressione Esc para sair da tela cheia.</p>
   <div className={`relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${fullscreen?'flex min-h-0 flex-1 flex-col sm:flex-row':''}`}>
    <div className={fullscreen?'min-h-0 min-w-0 flex-1':'contents'}>
     <svg className={fullscreen?'h-full w-full cursor-grab touch-none select-none active:cursor-grabbing':'h-[38rem] w-full cursor-grab touch-none select-none active:cursor-grabbing'} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label="Mapa mental completo das ideias aprovadas" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onPointerLeave={endPan} onWheel={handleWheel}>
      <rect x="0" y="0" width={CANVAS_WIDTH} height={layout.height} fill="#f8fafc"/>
      {layout.areas.map(area=><path key={`root-${area.id}`} d={`M 270 ${rootY} C 300 ${rootY}, 300 ${area.y}, 340 ${area.y}`} fill="none" stroke={area.color} strokeWidth="5" opacity=".38"/>)}
      {layout.areas.flatMap(area=>area.pillars.map(pillar=><path key={`area-${pillar.key}`} d={`M 580 ${area.y} C 615 ${area.y}, 610 ${pillar.y}, 650 ${pillar.y}`} fill="none" stroke={area.color} strokeWidth="4" opacity=".34"/>))}
      {layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups.map(group=><path key={`pillar-${group.key}`} d={`M 900 ${pillar.y} C 940 ${pillar.y}, 930 ${group.y}, 980 ${group.y}`} fill="none" stroke={area.color} strokeWidth="3" opacity=".3"/>)))}
      {layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups.flatMap(group=>group.ideas.map(idea=><path key={`group-${idea.id}`} d={`M 1400 ${group.y} C 1435 ${group.y}, 1435 ${idea.y}, 1480 ${idea.y}`} fill="none" stroke={area.color} strokeWidth="2" opacity=".25"/>))))}
      <g data-map-node><rect x="30" y={rootY-48} width="240" height="96" rx="24" fill="#13211f"/><text x="150" y={rootY-8} textAnchor="middle" fill="white" fontSize="21" fontWeight="800">ALPHA 2026</text><text x="150" y={rootY+22} textAnchor="middle" fill="#d5f2eb" fontSize="14">{layout.groupCount} grupos · {layout.ideaCount} ideias</text></g>
      {layout.areas.map(area=><g data-map-node key={area.id} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`Setor ${area.name}, ${area.groupCount} grupos`} onClick={()=>focusArea(area)} onKeyDown={event=>activate(event,()=>focusArea(area))}><rect x={area.x} y={area.y-38} width="240" height="76" rx="20" fill={area.color}/><text x={area.x+120} y={area.y-5} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{area.name}</text><text x={area.x+120} y={area.y+21} textAnchor="middle" fill="white" fontSize="13">{area.groupCount} grupos · {area.ideaCount} ideias</text></g>)}
      {layout.areas.flatMap(area=>area.pillars.map(pillar=><g data-map-node key={pillar.key} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`Pilar ${pillar.name} do setor ${area.name}, ${pillar.groups.length} grupos`} onClick={()=>focusPillar(pillar)} onKeyDown={event=>activate(event,()=>focusPillar(pillar))}><rect x={pillar.x} y={pillar.y-34} width="250" height="68" rx="18" fill={area.softColor} stroke={area.color} strokeWidth="3"/><text x={pillar.x+125} y={pillar.y-4} textAnchor="middle" fill={area.color} fontSize="17" fontWeight="800">{pillar.name}</text><text x={pillar.x+125} y={pillar.y+20} textAnchor="middle" fill={area.color} fontSize="12">{pillar.groups.length} grupos · {pillar.groups.reduce((sum,group)=>sum+group.ideas.length,0)} ideias</text></g>))}
      {layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups.map(group=>{const active=selectedGroupKey===group.key&&!selectedIdeaId;const matched=!normalized||group.searchText.includes(normalized);const lines=splitLabel(group.group.title,42,2);return <g data-map-node key={group.key} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`Grupo ${group.group.title}, ${group.ideas.length} ideias no pilar ${pillar.name}`} onClick={()=>focusGroup(group)} onKeyDown={event=>activate(event,()=>focusGroup(group))} opacity={matched?1:.14}><rect x={group.x} y={group.y-36} width="420" height="72" rx="17" fill={active?area.color:'white'} stroke={area.color} strokeWidth={active?5:2}/><text x={group.x+18} y={group.y-(lines.length===1?0:10)} fill={active?'white':'#13211f'} fontSize="14" fontWeight="750">{lines.map((line,index)=><tspan x={group.x+18} dy={index===0?0:19} key={`${group.key}-${index}`}>{line}</tspan>)}</text><text x={group.x+397} y={group.y+5} textAnchor="end" fill={active?'white':area.color} fontSize="13" fontWeight="800">{group.ideas.length}</text></g>})))}
      {layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups.flatMap(group=>group.ideas.map((idea,index)=>{const active=selectedIdeaId===idea.id;const matched=!normalized||idea.searchText.includes(normalized)||group.searchText.includes(normalized);const lines=splitLabel(idea.text,66,2);return <g data-map-node key={idea.id} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`Ideia original ${index+1}: ${idea.text}`} onClick={()=>focusIdea(group,idea)} onKeyDown={event=>activate(event,()=>focusIdea(group,idea))} opacity={matched?1:.12}><rect x={idea.x} y={idea.y-31} width="720" height="62" rx="15" fill={active?area.softColor:'#f1f5f9'} stroke={active?area.color:'#cbd5e1'} strokeWidth={active?4:1.5}/><text x={idea.x+16} y={idea.y-(lines.length===1?0:9)} fill="#253433" fontSize="13" fontWeight="650">{lines.map((line,lineIndex)=><tspan x={idea.x+16} dy={lineIndex===0?0:18} key={`${idea.id}-${lineIndex}`}>{line}</tspan>)}</text></g>}))))}
     </svg>
    </div>
    {fullscreen&&details&&<aside className="relative max-h-[45%] w-full shrink-0 overflow-y-auto border-t border-brand-200 bg-white p-4 shadow-2xl sm:max-h-none sm:w-[32rem] sm:border-l sm:border-t-0">{details}</aside>}
   </div>
  </div>
  {!fullscreen&&details&&<section className="card relative mt-5 border-brand-200">{details}</section>}
 </section>
}

function pillarRank(value:string){const index=PILLAR_ORDER.indexOf(value);return index<0?PILLAR_ORDER.length:index}
function splitLabel(value:string,max=55,maxLines=2){
 if(value.length<=max)return[value];
 const words=value.split(' ');const lines:string[]=[];let line='';
 for(const word of words){if(`${line} ${word}`.trim().length>max&&line){lines.push(line);line=word}else line=`${line} ${word}`.trim()}
 if(line)lines.push(line);
 if(lines.length<=maxLines)return lines;
 return[...lines.slice(0,maxLines-1),`${lines.slice(maxLines-1).join(' ').slice(0,max-1)}…`];
}
