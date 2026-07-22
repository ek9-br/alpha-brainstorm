import {SessionStatus} from '../types';
export const transitions:Record<SessionStatus,SessionStatus[]>= {WAITING:['PRESENTING'],PRESENTING:['IDEATION_OPEN','WAITING'],IDEATION_OPEN:['IDEATION_CLOSED'],IDEATION_CLOSED:['PRESENTING','AI_GROUPING'],AI_GROUPING:['GROUP_REVIEW'],GROUP_REVIEW:['VOTING_OPEN'],VOTING_OPEN:['VOTING_WAITING'],VOTING_WAITING:['VOTING_OPEN','RESULTS'],RESULTS:['WAITING','FINISHED'],FINISHED:[]};
export const canTransition=(from:SessionStatus,to:SessionStatus)=>transitions[from].includes(to);
