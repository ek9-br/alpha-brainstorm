import {CRITERIA,CriterionKey,Ratings} from '../types';
export type WeightedVote={ratings:Ratings;areaWeight:number};
export function weightedAverage(votes:WeightedVote[],criterion:CriterionKey){const total=votes.reduce((s,v)=>s+v.areaWeight,0);return total?votes.reduce((s,v)=>s+v.ratings[criterion]*v.areaWeight,0)/total:0}
export function areaWeight(participantArea:string,ideaArea:string,specialist=1.3){return participantArea===ideaArea&&!['diretoria','outro'].includes(ideaArea)?specialist:1}
export function score(votes:WeightedVote[]){const averages=Object.fromEntries(CRITERIA.map(([k])=>[k,weightedAverage(votes,k)])) as Ratings;const total=CRITERIA.reduce((s,[k,,,w])=>s+averages[k]*w,0);return{averages,total,percentage:total/210*100}}
export function classify(impact:number,viability:number,impactCut=3,viabilityCut=3){if(impact>=impactCut)return viability>=viabilityCut?'Quick Win':'Aposta Estratégica';return viability>=viabilityCut?'Melhoria Incremental':'Backlog'}
