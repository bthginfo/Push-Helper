import type { Session } from './types';
const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function conferenceNow(date=new Date()){
 const parts=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
 return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
export function sessionState(session:Session,now=new Date()):'upcoming'|'live'|'ended'{
 const t=conferenceNow(now);const stamp=t.day+'T'+t.time;
 if(stamp<session.day+'T'+session.start)return 'upcoming';
 if(stamp>=session.day+'T'+session.end)return 'ended';
 return 'live';
}
export const getLiveSessions=(sessions:Session[],now=new Date())=>sessions.filter(s=>sessionState(s,now)==='live');
export const getNextSession=(sessions:Session[],now=new Date())=>sessions.filter(s=>sessionState(s,now)==='upcoming').sort((a,b)=>(a.day+a.start).localeCompare(b.day+b.start))[0];
export function findConflicts(sessions:Session[]){
 const relevant=sessions.filter(s=>!['Pause','Organisation','Networking'].includes(s.type));
 return relevant.flatMap((s,i)=>relevant.slice(i+1).filter(t=>t.day===s.day&&t.start<s.end&&s.start<t.end).map(t=>[s.id,t.id] as const));
}
