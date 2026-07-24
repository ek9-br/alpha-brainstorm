import {KeyboardEvent,PointerEvent as ReactPointerEvent,WheelEvent as ReactWheelEvent,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ChevronsDownUp,LocateFixed,Maximize2,Minimize2,Network,Search,X,ZoomIn,ZoomOut} from 'lucide-react';
import {AdminWorkspace} from './AdminGrouping';

type Contribution=AdminWorkspace['ideas'][number];
type Group=AdminWorkspace['groups'][number];
type MapIdea=Contribution&{x:number;y:number;searchText:string};
type MapGroup={key:string;group:Group;x:number;y:number;startY:number;endY:number;ideas:MapIdea[];searchText:string};
type MapPillar={key:string;name:string;x:number;y:number;startY:number;endY:number;groups:MapGroup[]};
type MapArea=AdminWorkspace['areas'][number]&{x:number;y:number;color:string;softColor:string;startY:number;endY:number;pillars:MapPillar[];groupCount:number;ideaCount:number};
type SearchMatch={key:string;kind:'group'|'idea';group:MapGroup;idea?:MapIdea};
type FocusTarget={kind:'area'|'pillar'|'group'|'idea';key:string};

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
 const [query,setQuery]=useState('');
 const [matchIndex,setMatchIndex]=useState(-1);
 const [fullscreen,setFullscreen]=useState(false);
 const [selectedGroupKey,setSelectedGroupKey]=useState<string|null>(null);
 const [selectedIdeaId,setSelectedIdeaId]=useState<string|null>(null);
 const [navigationAreaId,setNavigationAreaId]=useState(workspace.areas[0]?.id||'');
 const [expandedAreas,setExpandedAreas]=useState<Set<string>>(()=>new Set());
 const [expandedPillars,setExpandedPillars]=useState<Set<string>>(()=>new Set());
 const [expandedGroups,setExpandedGroups]=useState<Set<string>>(()=>new Set());
 const [zoomLevel,setZoomLevel]=useState(()=>typeof window!=='undefined'&&window.innerWidth<640 ? .5 : .72);
 const [pendingFocus,setPendingFocus]=useState<FocusTarget|null>(null);
 const [isPanning,setIsPanning]=useState(false);
 const viewportRef=useRef<HTMLDivElement|null>(null);
 const panStart=useRef<{clientX:number;clientY:number;scrollLeft:number;scrollTop:number}|null>(null);
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
     const groupKey=`${group.id}:${pillarName}`;
     const mappedIdeas=ideas.map(idea=>{
      const mapped={...idea,x:1480,y:cursorY,searchText:`${idea.text} ${idea.expected_result||''} ${roundsById.get(idea.round_id)?.title||''}`.toLowerCase()};
      if(expandedAreas.has(area.id)&&expandedPillars.has(`${area.id}:${pillarName}`)&&expandedGroups.has(groupKey))cursorY+=76;
      return mapped
     });
     const groupExpanded=expandedAreas.has(area.id)&&expandedPillars.has(`${area.id}:${pillarName}`)&&expandedGroups.has(groupKey);
     if(!groupExpanded)cursorY+=96;
     const groupEnd=groupExpanded?cursorY-76:groupStart;
     const mapped:MapGroup={key:`${group.id}:${pillarName}`,group,x:980,y:(groupStart+groupEnd)/2,startY:groupStart,endY:groupEnd,ideas:mappedIdeas,searchText:`${group.title} ${group.description} ${mappedIdeas.map(idea=>idea.searchText).join(' ')}`.toLowerCase()};
     cursorY+=groupExpanded?28:14;
     return[mapped];
    });
    const pillarExpanded=expandedAreas.has(area.id)&&expandedPillars.has(`${area.id}:${pillarName}`);
    if(!pillarExpanded)cursorY=pillarStart+104;
    const pillarEnd=Math.max(pillarStart,cursorY-(pillarExpanded?28:0));
    const mapped={key:`${area.id}:${pillarName}`,name:pillarName,x:650,y:(pillarStart+pillarEnd)/2,startY:pillarStart,endY:pillarEnd,groups};
    cursorY+=pillarExpanded?48:18;
    return mapped;
   });
   if(!expandedAreas.has(area.id))cursorY=areaStart+112;
   const areaEnd=Math.max(areaStart,cursorY-(expandedAreas.has(area.id)?48:0));
   const mapped={...area,x:340,y:(areaStart+areaEnd)/2,color:COLORS[areaIndex%COLORS.length].color,softColor:COLORS[areaIndex%COLORS.length].softColor,startY:areaStart,endY:areaEnd,pillars,groupCount:areaGroups.length,ideaCount:pillars.reduce((sum,pillar)=>sum+pillar.groups.reduce((total,group)=>total+group.ideas.length,0),0)};
   cursorY+=expandedAreas.has(area.id)?90:24;
   return mapped;
  });
  return {areas,height:Math.max(1000,cursorY),groupCount:approved.length,ideaCount:workspace.sources.filter(source=>approved.some(group=>group.id===source.consolidated_idea_id)).length};
 },[workspace.areas,workspace.groups,workspace.sources,sourceIdsByGroup,ideasById,roundsById,expandedAreas,expandedPillars,expandedGroups]);

 const allGroups=useMemo(()=>layout.areas.flatMap(area=>area.pillars.flatMap(pillar=>pillar.groups)),[layout]);
 const navigationArea=layout.areas.find(area=>area.id===navigationAreaId)||layout.areas[0];
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

 const zoom=(factor:number)=>setZoomLevel(current=>clampMindMapZoom(current*factor));
 const startPan=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==='touch'||event.button!==0||(event.target as Element).closest('[data-map-node]'))return;
  panStart.current={clientX:event.clientX,clientY:event.clientY,scrollLeft:event.currentTarget.scrollLeft,scrollTop:event.currentTarget.scrollTop};
  event.currentTarget.setPointerCapture(event.pointerId);
  setIsPanning(true);
  event.preventDefault()
 };
 const movePan=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!panStart.current)return;
  event.currentTarget.scrollLeft=panStart.current.scrollLeft-(event.clientX-panStart.current.clientX);
  event.currentTarget.scrollTop=panStart.current.scrollTop-(event.clientY-panStart.current.clientY);
  event.preventDefault()
 };
 const endPan=(event:ReactPointerEvent<HTMLDivElement>)=>{
  panStart.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  setIsPanning(false)
 };
 const wheelZoom=(event:ReactWheelEvent<HTMLDivElement>)=>{
  if(!event.ctrlKey&&!event.metaKey)return;
  event.preventDefault();
  const viewport=event.currentTarget;
  const bounds=viewport.getBoundingClientRect();
  const offsetX=event.clientX-bounds.left;
  const offsetY=event.clientY-bounds.top;
  const contentX=(viewport.scrollLeft+offsetX)/zoomLevel;
  const contentY=(viewport.scrollTop+offsetY)/zoomLevel;
  const next=clampMindMapZoom(zoomLevel*(event.deltaY>0 ? .88 : 1.12));
  setZoomLevel(next);
  requestAnimationFrame(()=>viewport.scrollTo({left:Math.max(0,contentX*next-offsetX),top:Math.max(0,contentY*next-offsetY)}))
 };
 const fitAll=()=>{
  const viewport=viewportRef.current;
  if(!viewport)return;
  const next=Math.min(viewport.clientWidth/CANVAS_WIDTH,viewport.clientHeight/layout.height);
  setZoomLevel(clampMindMapZoom(next));
  viewport.scrollTo({left:0,top:0})
 };
 const openArea=(areaId:string)=>setExpandedAreas(current=>current.has(areaId)?current:new Set(current).add(areaId));
 const openPillar=(pillarKey:string)=>setExpandedPillars(current=>current.has(pillarKey)?current:new Set(current).add(pillarKey));
 const openGroup=(groupKey:string)=>setExpandedGroups(current=>current.has(groupKey)?current:new Set(current).add(groupKey));
 const toggleArea=(area:MapArea)=>{
  setNavigationAreaId(area.id);
  setExpandedAreas(current=>{const next=new Set(current);next.has(area.id)?next.delete(area.id):next.add(area.id);return next})
 };
 const togglePillar=(area:MapArea,pillar:MapPillar)=>{
  openArea(area.id);
  setNavigationAreaId(area.id);
  setExpandedPillars(current=>{const next=new Set(current);next.has(pillar.key)?next.delete(pillar.key):next.add(pillar.key);return next})
 };
 const toggleGroup=(area:MapArea,pillar:MapPillar,group:MapGroup)=>{
  openArea(area.id);
  openPillar(pillar.key);
  setSelectedGroupKey(group.key);
  setSelectedIdeaId(null);
  setExpandedGroups(current=>{const next=new Set(current);next.has(group.key)?next.delete(group.key):next.add(group.key);return next})
 };
 const collapseAll=()=>{
  setExpandedAreas(new Set());
  setExpandedPillars(new Set());
  setExpandedGroups(new Set());
  setSelectedGroupKey(null);
  setSelectedIdeaId(null);
  viewportRef.current?.scrollTo({left:0,top:0})
 };
 const focusArea=(area:MapArea)=>{openArea(area.id);setNavigationAreaId(area.id);setPendingFocus({kind:'area',key:area.id})};
 const focusPillar=(pillar:MapPillar)=>{const areaId=pillar.key.slice(0,pillar.key.indexOf(':'));openArea(areaId);openPillar(pillar.key);setNavigationAreaId(areaId);setPendingFocus({kind:'pillar',key:pillar.key})};
 const controlArea=(area:MapArea)=>expandedAreas.has(area.id)?toggleArea(area):focusArea(area);
 const controlPillar=(area:MapArea,pillar:MapPillar)=>expandedAreas.has(area.id)&&expandedPillars.has(pillar.key)?togglePillar(area,pillar):focusPillar(pillar);
 const focusGroup=(group:MapGroup)=>{const pillarKey=`${group.group.area_id}:${group.key.slice(group.group.id.length+1)}`;openArea(group.group.area_id);openPillar(pillarKey);openGroup(group.key);setSelectedGroupKey(group.key);setSelectedIdeaId(null);setPendingFocus({kind:'group',key:group.key})};
 const focusIdea=(group:MapGroup,idea:MapIdea)=>{const pillarKey=`${group.group.area_id}:${group.key.slice(group.group.id.length+1)}`;openArea(group.group.area_id);openPillar(pillarKey);openGroup(group.key);setSelectedGroupKey(group.key);setSelectedIdeaId(idea.id);setPendingFocus({kind:'idea',key:idea.id})};
 const nextMatch=()=>{if(!matches.length)return;const index=(matchIndex+1)%matches.length;const match=matches[index];setMatchIndex(index);match.kind==='idea'&&match.idea?focusIdea(match.group,match.idea):focusGroup(match.group)};
 const handleSearch=(value:string)=>{setQuery(value);setMatchIndex(-1)};
 const activate=(event:KeyboardEvent<SVGGElement>,action:()=>void)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action()}};
 useLayoutEffect(()=>{
  if(!pendingFocus||!viewportRef.current)return;
  let point:{x:number;y:number}|null=null;
  if(pendingFocus.kind==='area'){const area=layout.areas.find(item=>item.id===pendingFocus.key);if(area)point={x:area.x+120,y:area.y}}
  if(pendingFocus.kind==='pillar'){const pillar=layout.areas.flatMap(area=>area.pillars).find(item=>item.key===pendingFocus.key);if(pillar)point={x:pillar.x+125,y:pillar.y}}
  if(pendingFocus.kind==='group'){const group=allGroups.find(item=>item.key===pendingFocus.key);if(group)point={x:group.x+210,y:group.y}}
  if(pendingFocus.kind==='idea'){const idea=allGroups.flatMap(group=>group.ideas).find(item=>item.id===pendingFocus.key);if(idea)point={x:idea.x+360,y:idea.y}}
  if(point){const viewport=viewportRef.current;viewport.scrollTo({left:Math.max(0,point.x*zoomLevel-viewport.clientWidth/2),top:Math.max(0,point.y*zoomLevel-viewport.clientHeight/2),behavior:'smooth'})}
  setPendingFocus(null)
 },[layout,allGroups,pendingFocus,zoomLevel]);
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
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Visão geral</p><h2 className="flex items-center gap-2 text-2xl font-black"><Network/>Mapa mental da votação</h2><p className="mt-1 text-sm text-slate-600">Abra somente os setores, pilares, grupos e ideias que quiser explorar.</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{layout.groupCount} grupos · {layout.ideaCount} ideias</span></div>
  <div className={fullscreen?'fixed inset-0 z-[100] flex flex-col bg-white p-3 sm:p-5':'card mt-5 p-3 sm:p-5'}>
   <div className="rounded-xl border border-brand-200 bg-brand-50 p-3"><p className="text-sm font-black text-brand-900">Controles para abrir e fechar</p><p className="mt-1 text-xs text-brand-800">Use <strong>+ Abrir</strong> ou <strong>− Fechar</strong>. Cada setor, pilar e grupo funciona de forma independente.</p></div>
   <div className="mt-3 flex items-start justify-between gap-3"><div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Setores</p><div className="flex flex-wrap gap-2">{layout.areas.map(area=>{const expanded=expandedAreas.has(area.id);return <button aria-expanded={expanded} className={`min-h-10 rounded-xl border px-3 text-sm font-bold transition hover:-translate-y-0.5 ${expanded?'shadow-sm ring-2 ring-offset-1':''}`} style={{borderColor:area.color,color:area.color,backgroundColor:expanded?area.softColor:'white'}} onClick={()=>controlArea(area)} key={area.id}><span className="mr-1 font-black">{expanded?'− Fechar':'+ Abrir'}</span> {area.name}</button>})}<button className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold" onClick={fitAll}><Maximize2 className="mr-1 inline" size={15}/>Ver tudo</button><button className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold" onClick={collapseAll}><ChevronsDownUp className="mr-1 inline" size={15}/>Recolher tudo</button></div></div><button className="btn-secondary shrink-0" onClick={()=>setFullscreen(value=>!value)}>{fullscreen?<><Minimize2 className="mr-2" size={18}/>Sair da tela cheia</>:<><Maximize2 className="mr-2" size={18}/>Abrir em tela cheia</>}</button></div>
   {navigationArea&&<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Pilares de {navigationArea.name}</span><div className="mt-2 flex flex-wrap gap-2">{navigationArea.pillars.map(pillar=>{const expanded=expandedAreas.has(navigationArea.id)&&expandedPillars.has(pillar.key);return <button aria-expanded={expanded} className={`rounded-lg border px-3 py-2 text-xs font-bold ${expanded?'shadow-sm ring-2 ring-offset-1':'hover:bg-slate-50'}`} style={{borderColor:navigationArea.color,color:navigationArea.color,backgroundColor:expanded?navigationArea.softColor:'white'}} onClick={()=>controlPillar(navigationArea,pillar)} key={pillar.key}><span className="mr-1 font-black">{expanded?'− Fechar':'+ Abrir'}</span> {pillar.name} · {pillar.groups.length}</button>})}</div></div>}
   <div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-64 flex-1"><span className="label">Buscar grupo ou ideia original</span><span className="relative block"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input className="field pl-10" value={query} onChange={event=>handleSearch(event.target.value)} onKeyDown={event=>event.key==='Enter'&&nextMatch()} placeholder="Ex.: CRM, documentos, parceiros"/></span></label><button className="btn-secondary" disabled={!normalized||matches.length===0} onClick={nextMatch}><LocateFixed className="mr-2" size={17}/>{normalized?`${matches.length} resultado(s)`:'Localizar'}</button><div className="flex gap-1"><button aria-label="Aumentar mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(1.18)}><ZoomIn size={19}/></button><button aria-label="Diminuir mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(.85)}><ZoomOut size={19}/></button></div></div>
   <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-900 px-3 py-1 text-white">Setor</span><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Pilar</span><span className="rounded-full border border-slate-400 bg-white px-3 py-1">Grupo</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Ideia original</span></div>
   <p className="mt-2 text-xs text-slate-500">Arraste o fundo para navegar livremente. Use a roda para rolar, Ctrl/⌘ + roda ou os botões + e − para ampliar. Clique nos nós para abrir e fechar os ramos.</p>
   <div className={`relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${fullscreen?'flex min-h-0 flex-1 flex-col sm:flex-row':''}`}>
    <div
     ref={viewportRef}
     aria-label="Área navegável do mapa mental"
     className={`${fullscreen?'min-h-0 min-w-0 flex-1':'h-[38rem] w-full'} ${isPanning?'cursor-grabbing':'cursor-grab'} overflow-auto overscroll-contain outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400`}
     onPointerDown={startPan}
     onPointerMove={movePan}
     onPointerUp={endPan}
     onPointerCancel={endPan}
     onWheel={wheelZoom}
     tabIndex={0}
    >
     <svg className="block max-w-none select-none" width={CANVAS_WIDTH*zoomLevel} height={layout.height*zoomLevel} viewBox={`0 0 ${CANVAS_WIDTH} ${layout.height}`} role="img" aria-label="Mapa mental completo das ideias aprovadas">
      <rect x="0" y="0" width={CANVAS_WIDTH} height={layout.height} fill="#f8fafc"/>
      {layout.areas.map(area=><path key={`root-${area.id}`} d={`M 270 ${rootY} C 300 ${rootY}, 300 ${area.y}, 340 ${area.y}`} fill="none" stroke={area.color} strokeWidth="5" opacity=".38"/>)}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.map(pillar=><path key={`area-${pillar.key}`} d={`M 580 ${area.y} C 615 ${area.y}, 610 ${pillar.y}, 650 ${pillar.y}`} fill="none" stroke={area.color} strokeWidth="4" opacity=".34"/>))}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.filter(pillar=>expandedPillars.has(pillar.key)).flatMap(pillar=>pillar.groups.map(group=><path key={`pillar-${group.key}`} d={`M 900 ${pillar.y} C 940 ${pillar.y}, 930 ${group.y}, 980 ${group.y}`} fill="none" stroke={area.color} strokeWidth="3" opacity=".3"/>)))}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.filter(pillar=>expandedPillars.has(pillar.key)).flatMap(pillar=>pillar.groups.filter(group=>expandedGroups.has(group.key)).flatMap(group=>group.ideas.map(idea=><path key={`group-${idea.id}`} d={`M 1400 ${group.y} C 1435 ${group.y}, 1435 ${idea.y}, 1480 ${idea.y}`} fill="none" stroke={area.color} strokeWidth="2" opacity=".25"/>))))}
      <g data-map-node><rect x="30" y={rootY-48} width="240" height="96" rx="24" fill="#13211f"/><text x="150" y={rootY-8} textAnchor="middle" fill="white" fontSize="21" fontWeight="800">ALPHA 2026</text><text x="150" y={rootY+22} textAnchor="middle" fill="#d5f2eb" fontSize="14">{layout.groupCount} grupos · {layout.ideaCount} ideias</text></g>
      {layout.areas.map(area=>{const expanded=expandedAreas.has(area.id);return <g data-map-node key={area.id} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-expanded={expanded} aria-label={`Setor ${area.name}, ${area.groupCount} grupos`} onClick={()=>toggleArea(area)} onKeyDown={event=>activate(event,()=>toggleArea(area))}><rect x={area.x} y={area.y-38} width="240" height="76" rx="20" fill={area.color}/><rect x={area.x+10} y={area.y-17} width="66" height="34" rx="17" fill="white" opacity=".2"/><text x={area.x+43} y={area.y+4} textAnchor="middle" fill="white" fontSize="10" fontWeight="900">{expanded?'− FECHAR':'+ ABRIR'}</text><text x={area.x+158} y={area.y-5} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{area.name}</text><text x={area.x+158} y={area.y+21} textAnchor="middle" fill="white" fontSize="13">{area.groupCount} grupos · {area.ideaCount} ideias</text></g>})}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.map(pillar=>{const expanded=expandedPillars.has(pillar.key);return <g data-map-node key={pillar.key} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-expanded={expanded} aria-label={`Pilar ${pillar.name} do setor ${area.name}, ${pillar.groups.length} grupos`} onClick={()=>togglePillar(area,pillar)} onKeyDown={event=>activate(event,()=>togglePillar(area,pillar))}><rect x={pillar.x} y={pillar.y-34} width="250" height="68" rx="18" fill={area.softColor} stroke={area.color} strokeWidth="3"/><rect x={pillar.x+8} y={pillar.y-16} width="64" height="32" rx="16" fill={area.color} opacity=".13"/><text x={pillar.x+40} y={pillar.y+4} textAnchor="middle" fill={area.color} fontSize="9" fontWeight="900">{expanded?'− FECHAR':'+ ABRIR'}</text><text x={pillar.x+158} y={pillar.y-4} textAnchor="middle" fill={area.color} fontSize="17" fontWeight="800">{pillar.name}</text><text x={pillar.x+158} y={pillar.y+20} textAnchor="middle" fill={area.color} fontSize="12">{pillar.groups.length} grupos · {pillar.groups.reduce((sum,group)=>sum+group.ideas.length,0)} ideias</text></g>}))}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.filter(pillar=>expandedPillars.has(pillar.key)).flatMap(pillar=>pillar.groups.map(group=>{const expanded=expandedGroups.has(group.key);const active=selectedGroupKey===group.key&&!selectedIdeaId;const matched=!normalized||group.searchText.includes(normalized);const lines=splitLabel(group.group.title,34,2);return <g data-map-node key={group.key} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-expanded={expanded} aria-label={`Grupo ${group.group.title}, ${group.ideas.length} ideias no pilar ${pillar.name}`} onClick={()=>toggleGroup(area,pillar,group)} onKeyDown={event=>activate(event,()=>toggleGroup(area,pillar,group))} opacity={matched?1:.14}><rect x={group.x} y={group.y-36} width="420" height="72" rx="17" fill={active?area.color:'white'} stroke={area.color} strokeWidth={active?5:2}/><rect x={group.x+335} y={group.y-16} width="72" height="32" rx="16" fill={active?'white':area.softColor} opacity={active ? .22 : 1}/><text x={group.x+371} y={group.y+4} textAnchor="middle" fill={active?'white':area.color} fontSize="9" fontWeight="900">{expanded?'− FECHAR':`+ ABRIR · ${group.ideas.length}`}</text><text x={group.x+18} y={group.y-(lines.length===1?0:10)} fill={active?'white':'#13211f'} fontSize="14" fontWeight="750">{lines.map((line,index)=><tspan x={group.x+18} dy={index===0?0:19} key={`${group.key}-${index}`}>{line}</tspan>)}</text></g>})))}
      {layout.areas.filter(area=>expandedAreas.has(area.id)).flatMap(area=>area.pillars.filter(pillar=>expandedPillars.has(pillar.key)).flatMap(pillar=>pillar.groups.filter(group=>expandedGroups.has(group.key)).flatMap(group=>group.ideas.map((idea,index)=>{const active=selectedIdeaId===idea.id;const matched=!normalized||idea.searchText.includes(normalized)||group.searchText.includes(normalized);const lines=splitLabel(idea.text,66,2);return <g data-map-node key={idea.id} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`Ideia original ${index+1}: ${idea.text}`} onClick={()=>focusIdea(group,idea)} onKeyDown={event=>activate(event,()=>focusIdea(group,idea))} opacity={matched?1:.12}><rect x={idea.x} y={idea.y-31} width="720" height="62" rx="15" fill={active?area.softColor:'#f1f5f9'} stroke={active?area.color:'#cbd5e1'} strokeWidth={active?4:1.5}/><text x={idea.x+16} y={idea.y-(lines.length===1?0:9)} fill="#253433" fontSize="13" fontWeight="650">{lines.map((line,lineIndex)=><tspan x={idea.x+16} dy={lineIndex===0?0:18} key={`${idea.id}-${lineIndex}`}>{line}</tspan>)}</text></g>}))))}
     </svg>
    </div>
    {fullscreen&&details&&<aside className="relative max-h-[45%] w-full shrink-0 overflow-y-auto border-t border-brand-200 bg-white p-4 shadow-2xl sm:max-h-none sm:w-[32rem] sm:border-l sm:border-t-0">{details}</aside>}
   </div>
  </div>
  {!fullscreen&&details&&<section className="card relative mt-5 border-brand-200">{details}</section>}
 </section>
}

function pillarRank(value:string){const index=PILLAR_ORDER.indexOf(value);return index<0?PILLAR_ORDER.length:index}
export function clampMindMapZoom(value:number){return Number.isFinite(value)?Math.max(.2,Math.min(1.5,value)):.72}
function splitLabel(value:string,max=55,maxLines=2){
 if(value.length<=max)return[value];
 const words=value.split(' ');const lines:string[]=[];let line='';
 for(const word of words){if(`${line} ${word}`.trim().length>max&&line){lines.push(line);line=word}else line=`${line} ${word}`.trim()}
 if(line)lines.push(line);
 if(lines.length<=maxLines)return lines;
 return[...lines.slice(0,maxLines-1),`${lines.slice(maxLines-1).join(' ').slice(0,max-1)}…`];
}
