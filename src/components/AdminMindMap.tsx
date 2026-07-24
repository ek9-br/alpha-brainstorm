import {KeyboardEvent,PointerEvent,useEffect,useMemo,useRef,useState,WheelEvent} from 'react';
import {LocateFixed,Maximize2,Minimize2,Network,Search,X,ZoomIn,ZoomOut} from 'lucide-react';
import {AdminWorkspace} from './AdminGrouping';

type ViewBox={x:number;y:number;width:number;height:number};
type MapGroup=AdminWorkspace['groups'][number]&{x:number;y:number;sourceCount:number;searchText:string};
type MapArea=AdminWorkspace['areas'][number]&{x:number;y:number;color:string;softColor:string;groups:MapGroup[];startY:number;endY:number};

const CANVAS_WIDTH=1540;
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
 const [selectedId,setSelectedId]=useState<string|null>(workspace.session.current_consolidated_idea_id);
 const [matchIndex,setMatchIndex]=useState(0);
 const [fullscreen,setFullscreen]=useState(false);
 const panStart=useRef<{clientX:number;clientY:number;viewX:number;viewY:number}|null>(null);
 const roundsById=useMemo(()=>new Map(workspace.rounds.map(round=>[round.id,round])),[workspace.rounds]);
 const sourceIdsByGroup=useMemo(()=>{const result=new Map<string,string[]>();workspace.sources.forEach(source=>result.set(source.consolidated_idea_id,[...(result.get(source.consolidated_idea_id)||[]),source.idea_id]));return result},[workspace.sources]);
 const ideasById=useMemo(()=>new Map(workspace.ideas.map(idea=>[idea.id,idea])),[workspace.ideas]);
 const layout=useMemo(()=>{
  let cursorY=90;
  const approved=[...workspace.groups].filter(group=>group.approved).sort((a,b)=>a.display_order-b.display_order);
  const areas:MapArea[]=workspace.areas.map((area,areaIndex)=>{
   const areaGroups=approved.filter(group=>group.area_id===area.id);
   const startY=cursorY;
   const groups=areaGroups.map(group=>{
    const sourceIds=sourceIdsByGroup.get(group.id)||[];
    const sourceText=sourceIds.map(id=>ideasById.get(id)?.text||'').join(' ');
    const mapped={...group,x:800,y:cursorY,sourceCount:sourceIds.length,searchText:`${group.title} ${group.description} ${sourceText}`.toLowerCase()};
    cursorY+=94;
    return mapped;
   });
   const endY=Math.max(startY,cursorY-94);
   const position={...area,x:380,y:(startY+endY)/2,color:COLORS[areaIndex%COLORS.length].color,softColor:COLORS[areaIndex%COLORS.length].softColor,groups,startY,endY};
   cursorY+=100;
   return position;
  });
  return {areas,height:Math.max(900,cursorY)};
 },[workspace.areas,workspace.groups,sourceIdsByGroup,ideasById]);
 const [view,setView]=useState<ViewBox>(compact?{x:760,y:20,width:720,height:1180}:{x:250,y:20,width:1260,height:760});
 const normalized=query.trim().toLowerCase();
 const matches=useMemo(()=>layout.areas.flatMap(area=>area.groups).filter(group=>!normalized||group.searchText.includes(normalized)),[layout,normalized]);
 const selected=layout.areas.flatMap(area=>area.groups).find(group=>group.id===selectedId)||null;
 const selectedSources=selected?(sourceIdsByGroup.get(selected.id)||[]).map(id=>ideasById.get(id)).filter(Boolean) as AdminWorkspace['ideas']:[];
 const rootY=layout.height/2;
 const clamp=(next:ViewBox):ViewBox=>({...next,x:Math.max(-100,Math.min(CANVAS_WIDTH-next.width+100,next.x)),y:Math.max(-100,Math.min(layout.height-next.height+100,next.y))});
 const zoom=(factor:number)=>setView(current=>{const width=Math.max(520,Math.min(CANVAS_WIDTH*1.08,current.width*factor));const height=width*(current.height/current.width);return clamp({x:current.x+(current.width-width)/2,y:current.y+(current.height-height)/2,width,height})});
 const fitAll=()=>setView({x:0,y:0,width:CANVAS_WIDTH,height:layout.height});
 const focusArea=(area:MapArea)=>setView(clamp(compact?{x:760,y:area.startY-70,width:720,height:1180}:{x:280,y:area.startY-70,width:1240,height:Math.max(520,Math.min(900,area.endY-area.startY+200))}));
 const focusGroup=(group:MapGroup)=>{setSelectedId(group.id);setView(clamp(compact?{x:760,y:group.y-500,width:720,height:1000}:{x:320,y:group.y-260,width:1160,height:520}))};
 const nextMatch=()=>{if(!matches.length)return;const next=matches[(matchIndex+1)%matches.length];setMatchIndex((matchIndex+1)%matches.length);focusGroup(next)};
 const handleSearch=(value:string)=>{setQuery(value);setMatchIndex(-1)};
 const handleKey=(event:KeyboardEvent<SVGGElement>,group:MapGroup)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focusGroup(group)}};
 const startPan=(event:PointerEvent<SVGSVGElement>)=>{if((event.target as Element).closest('[data-map-node]'))return;event.currentTarget.setPointerCapture(event.pointerId);panStart.current={clientX:event.clientX,clientY:event.clientY,viewX:view.x,viewY:view.y}};
 const movePan=(event:PointerEvent<SVGSVGElement>)=>{if(!panStart.current)return;const bounds=event.currentTarget.getBoundingClientRect();const dx=(event.clientX-panStart.current.clientX)*view.width/bounds.width;const dy=(event.clientY-panStart.current.clientY)*view.height/bounds.height;setView(current=>clamp({...current,x:panStart.current!.viewX-dx,y:panStart.current!.viewY-dy}))};
 const endPan=()=>{panStart.current=null};
 const handleWheel=(event:WheelEvent<SVGSVGElement>)=>{event.preventDefault();zoom(event.deltaY>0?1.12:.88)};
 useEffect(()=>{if(!fullscreen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setFullscreen(false)};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close)}},[fullscreen]);

 if(layout.areas.every(area=>area.groups.length===0))return null;
 return <section className="mt-8">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold text-brand-700">Visão geral</p><h2 className="flex items-center gap-2 text-2xl font-black"><Network/>Mapa mental da votação</h2><p className="mt-1 text-sm text-slate-600">Explore todos os setores e abra qualquer iniciativa para conferir por que as contribuições foram agrupadas.</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{layout.areas.reduce((sum,area)=>sum+area.groups.length,0)} ideias aprovadas</span></div>
  <div className={fullscreen?'fixed inset-0 z-[100] flex flex-col bg-white p-3 sm:p-5':'card mt-5 p-3 sm:p-5'}>
   <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2">{layout.areas.map(area=><button className="min-h-10 rounded-xl border px-3 text-sm font-bold transition hover:-translate-y-0.5" style={{borderColor:area.color,color:area.color,backgroundColor:area.softColor}} onClick={()=>focusArea(area)} key={area.id}>{area.name} · {area.groups.length}</button>)}<button className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold" onClick={fitAll}><Maximize2 className="mr-1 inline" size={15}/>Ver tudo</button></div><button className="btn-secondary shrink-0" onClick={()=>setFullscreen(value=>!value)}>{fullscreen?<><Minimize2 className="mr-2" size={18}/>Sair da tela cheia</>:<><Maximize2 className="mr-2" size={18}/>Abrir em tela cheia</>}</button></div>
   <div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-64 flex-1"><span className="label">Buscar ideia ou contribuição</span><span className="relative block"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input className="field pl-10" value={query} onChange={event=>handleSearch(event.target.value)} onKeyDown={event=>event.key==='Enter'&&nextMatch()} placeholder="Ex.: CRM, documentos, parceiros"/></span></label><button className="btn-secondary" disabled={!normalized||matches.length===0} onClick={nextMatch}><LocateFixed className="mr-2" size={17}/>{normalized?`${matches.length} resultado(s)`:'Localizar'}</button><div className="flex gap-1"><button aria-label="Aumentar mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(.82)}><ZoomIn size={19}/></button><button aria-label="Diminuir mapa" className="btn-secondary min-w-12 px-3" onClick={()=>zoom(1.2)}><ZoomOut size={19}/></button></div></div>
   <p className="mt-3 text-xs text-slate-500">Arraste qualquer espaço vazio para navegar, use a roda do mouse ou os botões para ampliar e clique em uma ideia para abrir seus detalhes. Pressione Esc para sair da tela cheia.</p>
   <div className={`relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${fullscreen?'flex min-h-0 flex-1 flex-col sm:flex-row':''}`}>
    <div className={fullscreen?'min-h-0 min-w-0 flex-1':'contents'}>
    <svg className={fullscreen?'h-full w-full cursor-grab touch-none select-none active:cursor-grabbing':'h-[34rem] w-full cursor-grab touch-none select-none active:cursor-grabbing sm:h-[38rem]'} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label="Mapa mental das ideias aprovadas para votação" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onPointerLeave={endPan} onWheel={handleWheel}>
     <rect x="0" y="0" width={CANVAS_WIDTH} height={layout.height} fill="#f8fafc"/>
     {layout.areas.map(area=><path key={`root-${area.id}`} d={`M 300 ${rootY} C 340 ${rootY}, 330 ${area.y}, 380 ${area.y}`} fill="none" stroke={area.color} strokeWidth="5" opacity=".42"/>)}
     {layout.areas.flatMap(area=>area.groups.map(group=><path key={`edge-${group.id}`} d={`M 660 ${area.y} C 720 ${area.y}, 720 ${group.y}, 800 ${group.y}`} fill="none" stroke={area.color} strokeWidth="3" opacity=".34"/>))}
     <g data-map-node><rect x="40" y={rootY-47} width="260" height="94" rx="24" fill="#13211f"/><text x="170" y={rootY-8} textAnchor="middle" fill="white" fontSize="22" fontWeight="800">ALPHA 2026</text><text x="170" y={rootY+22} textAnchor="middle" fill="#d5f2eb" fontSize="15">48 iniciativas para votação</text></g>
     {layout.areas.map(area=><g data-map-node key={area.id} className="cursor-pointer" role="button" aria-label={`Focar setor ${area.name}`} onClick={()=>focusArea(area)}><rect x={area.x} y={area.y-38} width="280" height="76" rx="20" fill={area.color}/><text x={area.x+140} y={area.y-4} textAnchor="middle" fill="white" fontSize="20" fontWeight="800">{area.name}</text><text x={area.x+140} y={area.y+22} textAnchor="middle" fill="white" fontSize="14" opacity=".9">{area.groups.length} ideias</text></g>)}
     {layout.areas.flatMap(area=>area.groups.map(group=>{const active=selectedId===group.id;const matched=!normalized||group.searchText.includes(normalized);const lines=splitLabel(group.title);return <g data-map-node key={group.id} className="cursor-pointer outline-none" role="button" tabIndex={0} aria-label={`${group.title}, ${group.sourceCount} contribuições`} onClick={()=>focusGroup(group)} onKeyDown={event=>handleKey(event,group)} opacity={matched?1:.18}><rect x={group.x} y={group.y-37} width="650" height="74" rx="18" fill={active?area.color:'white'} stroke={area.color} strokeWidth={active?5:2}/><text x={group.x+24} y={group.y-(lines.length===1?0:11)} fill={active?'white':'#13211f'} fontSize="17" fontWeight="750">{lines.map((line,index)=><tspan x={group.x+24} dy={index===0?0:22} key={line}>{line}</tspan>)}</text><text x={group.x+620} y={group.y+5} textAnchor="end" fill={active?'white':area.color} fontSize="14" fontWeight="800">{group.sourceCount}</text><circle cx={group.x+628} cy={group.y-20} r="9" fill={area.color}/></g>}))}
    </svg>
    </div>
    {fullscreen&&selected&&<aside className="relative max-h-[45%] w-full shrink-0 overflow-y-auto border-t border-brand-200 bg-white p-4 shadow-2xl sm:max-h-none sm:w-[30rem] sm:border-l sm:border-t-0"><button aria-label="Fechar detalhes" className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={()=>setSelectedId(null)}><X size={18}/></button><p className="pr-10 text-sm font-bold text-brand-700">Ideia selecionada · {workspace.areas.find(area=>area.id===selected.area_id)?.name}</p><h3 className="mt-1 pr-10 text-xl font-black">{selected.title}</h3><p className="mt-2 text-sm text-slate-600">{selected.description}</p><p className="mt-4 font-bold">{selectedSources.length} contribuições agrupadas</p><div className="mt-3 space-y-3">{selectedSources.map((idea,index)=><article className="rounded-xl border border-slate-200 bg-white p-3" key={idea.id}><p className="text-xs font-bold text-slate-500">{index+1}. {roundsById.get(idea.round_id)?.title}</p><p className="mt-2 text-sm">{idea.text}</p>{idea.expected_result&&<p className="mt-2 text-xs text-slate-600"><strong>Resultado esperado:</strong> {idea.expected_result}</p>}</article>)}</div></aside>}
   </div>
  </div>
  {!fullscreen&&selected&&<section className="card mt-5 border-brand-200"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-brand-700">Ideia selecionada · {workspace.areas.find(area=>area.id===selected.area_id)?.name}</p><h3 className="mt-1 text-2xl font-black">{selected.title}</h3><p className="mt-2 max-w-4xl text-slate-600">{selected.description}</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{selectedSources.length} contribuições agrupadas</span></div><details className="mt-4 rounded-xl bg-slate-50 p-4" open><summary className="cursor-pointer font-bold">Ver as ideias que formaram este grupo</summary><div className="mt-3 grid gap-3 lg:grid-cols-2">{selectedSources.map((idea,index)=><article className="rounded-xl border border-slate-200 bg-white p-4" key={idea.id}><p className="text-xs font-bold text-slate-500">{index+1}. {roundsById.get(idea.round_id)?.title}</p><p className="mt-2 text-sm">{idea.text}</p>{idea.expected_result&&<p className="mt-2 text-xs text-slate-600"><strong>Resultado esperado:</strong> {idea.expected_result}</p>}</article>)}</div></details></section>}
 </section>
}

function splitLabel(value:string){
 if(value.length<=55)return[value];
 const words=value.split(' ');const lines:string[]=[];let line='';
 for(const word of words){if(`${line} ${word}`.trim().length>55&&line){lines.push(line);line=word}else line=`${line} ${word}`.trim()}
 if(line)lines.push(line);
 if(lines.length<=2)return lines;
 return[lines[0],`${lines.slice(1).join(' ').slice(0,52)}…`];
}
