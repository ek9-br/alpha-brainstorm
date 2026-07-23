export type GroupingIdea={id:string;area_id:string;area_name:string;text:string};
export type GroupingSuggestion={title:string;description:string;area_id:string;idea_ids:string[]};

const stopwords=new Set(['como','para','uma','com','que','isso','mais','menos','nosso','nossa','podemos','fazer','empresa','alpha','ideia']);
const words=(text:string)=>[...new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(word=>word.length>3&&!stopwords.has(word)))];
const similarity=(a:string,b:string)=>{const left=new Set(words(a));const right=new Set(words(b));return [...left].filter(word=>right.has(word)).length};
const cleanTitle=(text:string)=>{const value=text.trim().replace(/[.!?]+$/,'');return value.length<=90?value:`${value.slice(0,87)}…`};

export function fallbackGroups(ideas:GroupingIdea[]):GroupingSuggestion[]{
 const groups:GroupingSuggestion[]=[];
 for(const idea of ideas){const match=groups.find(group=>group.area_id===idea.area_id&&group.idea_ids.some(id=>{const existing=ideas.find(item=>item.id===id);return existing?similarity(existing.text,idea.text)>=2:false}));if(match){match.idea_ids.push(idea.id);match.description=`Agrupamento operacional com ${match.idea_ids.length} contribuições relacionadas.`}else groups.push({title:cleanTitle(idea.text),description:'Sugestão criada pelo fallback operacional para revisão do facilitador.',area_id:idea.area_id,idea_ids:[idea.id]})}
 return groups;
}

export function validateSuggestions(value:unknown,ideas:GroupingIdea[]):GroupingSuggestion[]{
 if(!value||typeof value!=='object'||!Array.isArray((value as {groups?:unknown}).groups))throw new Error('Resposta da IA fora do formato esperado');
 const known=new Map(ideas.map(idea=>[idea.id,idea]));const used=new Set<string>();const valid:GroupingSuggestion[]=[];
 for(const raw of (value as {groups:unknown[]}).groups){if(!raw||typeof raw!=='object')continue;const item=raw as Partial<GroupingSuggestion>;if(typeof item.title!=='string'||item.title.trim().length<2||typeof item.description!=='string'||typeof item.area_id!=='string'||!Array.isArray(item.idea_ids))continue;const ids=[...new Set(item.idea_ids.filter((id):id is string=>typeof id==='string'&&known.has(id)&&!used.has(id)))];if(!ids.length||ids.some(id=>known.get(id)?.area_id!==item.area_id))continue;ids.forEach(id=>used.add(id));valid.push({title:cleanTitle(item.title),description:item.description.trim().slice(0,800),area_id:item.area_id,idea_ids:ids})}
 const missing=ideas.filter(idea=>!used.has(idea.id));return [...valid,...fallbackGroups(missing)];
}

export const groupingJsonSchema={type:'object',additionalProperties:false,required:['groups'],properties:{groups:{type:'array',items:{type:'object',additionalProperties:false,required:['title','description','area_id','idea_ids'],properties:{title:{type:'string',minLength:2,maxLength:160},description:{type:'string',maxLength:800},area_id:{type:'string'},idea_ids:{type:'array',minItems:1,items:{type:'string'}}}}}}} as const;
