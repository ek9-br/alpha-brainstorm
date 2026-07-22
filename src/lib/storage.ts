const key=(code:string)=>`brainstorm:${code}:participant`;
export function saveParticipant(code:string,token:string){localStorage.setItem(key(code),token)}
export function restoreParticipant(code:string){const v=localStorage.getItem(key(code));return v&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)?v:null}
export function clearParticipant(code:string){localStorage.removeItem(key(code))}
