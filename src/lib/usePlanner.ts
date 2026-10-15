import {useCallback,useEffect,useRef,useState}from 'react';
import type {Profile,RoomData}from './types';
type Favorites=Record<Profile,string[]>;
type Operation={id:string;room:string;action:'favorite';profile:Profile;sessionId:string;selected:boolean}|{id:string;room:string;action:'rename';name:string};
type Stored={profile:Profile;name:string;favorites:Favorites;room:string|null;pending:Operation[]};
type Status='local'|'syncing'|'synced'|'offline'|'error';
const STORAGE='push-companion-planner-v1';
const empty=():Stored=>({profile:'you',name:'Ich',favorites:{you:[],daniel:[]},room:null,pending:[]});
function load():Stored{
 try{const s=JSON.parse(localStorage.getItem(STORAGE)||'null');if(!s)return empty();return {profile:s.profile==='daniel'?'daniel':'you',name:typeof s.name==='string'?s.name.slice(0,30):'Ich',favorites:{you:Array.isArray(s.favorites?.you)?s.favorites.you.filter((id:unknown)=>typeof id==='string'):[],daniel:Array.isArray(s.favorites?.daniel)?s.favorites.daniel.filter((id:unknown)=>typeof id==='string'):[]},room:typeof s.room==='string'&&/^[\w-]{43}$/.test(s.room)?s.room:null,pending:Array.isArray(s.pending)?s.pending.slice(0,500):[]};}catch{return empty();}
}
function overlay(data:RoomData,pending:Operation[],room:string){
 const result={name:data.name,favorites:{you:[...data.favorites.you],daniel:[...data.favorites.daniel]}};
 for(const op of pending.filter(o=>o.room===room)){if(op.action==='rename')result.name=op.name;else result.favorites[op.profile]=op.selected?[...new Set([...result.favorites[op.profile],op.sessionId])]:result.favorites[op.profile].filter(id=>id!==op.sessionId);}
 return result;
}
async function request(room:string|null,body?:unknown):Promise<RoomData&{room?:string}>{
 const response=await fetch('/api/rooms',{method:body?'POST':'GET',headers:{...(room?{'X-Room-Key':room}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15_000)});
 const data=await response.json().catch(()=>({error:'Die Synchronisierung ist nicht erreichbar.'}));
 if(!response.ok)throw new Error(data.error||'Der gemeinsame Plan konnte nicht geladen werden.');
 if(!data.favorites||!Array.isArray(data.favorites.you)||!Array.isArray(data.favorites.daniel)||typeof data.name!=='string')throw new Error('Der Server hat einen unvollständigen Plan zurückgegeben.');
 return data;
}
export function usePlanner(){
 const [state,setState]=useState<Stored>(load);const ref=useRef(state);
 const [syncStatus,setSyncStatus]=useState<Status>(state.room?'syncing':'local');
 const [error,setError]=useState<string|null>(null);const running=useRef(false);const mounted=useRef(true);
 const commit=useCallback((change:(s:Stored)=>Stored)=>{const next=change(ref.current);ref.current=next;setState(next);try{localStorage.setItem(STORAGE,JSON.stringify(next));}catch{setError('Auf diesem Gerät ist kein Speicher frei. Bitte halte die App geöffnet, bis deine Auswahl synchronisiert ist.');}},[]);
 const sync=useCallback(async()=>{
  const room=ref.current.room;if(!room||running.current)return;
  if(!navigator.onLine){setSyncStatus('offline');return;}
  running.current=true;setSyncStatus('syncing');
  try{
   let op:Operation|undefined;
   while((op=ref.current.pending.find(o=>o.room===room))&&ref.current.room===room){
    const sent=op;const data=await request(room,sent);
    if(!mounted.current)return;
    commit(s=>{const pending=s.pending.filter(o=>o.id!==sent.id);return s.room===room?{...s,...overlay(data,pending,room),pending}:{...s,pending};});
   }
   const data=await request(room);
   if(mounted.current&&ref.current.room===room){commit(s=>({...s,...overlay(data,s.pending,room)}));setSyncStatus('synced');setError(null);}
  }catch(e){if(mounted.current&&ref.current.room===room){setSyncStatus(navigator.onLine?'error':'offline');setError(e instanceof Error?e.message:'Bitte erneut synchronisieren.');}}
  finally{running.current=false;}
 },[commit]);
 useEffect(()=>{mounted.current=true;void sync();const refresh=()=>{if(document.visibilityState==='visible')void sync();};const offline=()=>setSyncStatus(ref.current.room?'offline':'local');const interval=window.setInterval(refresh,60_000);window.addEventListener('online',refresh);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',refresh);return()=>{mounted.current=false;clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',refresh);};},[sync,state.room]);
 useEffect(()=>{if(state.room&&state.pending.some(o=>o.room===state.room)){const timer=setTimeout(()=>void sync(),450);return()=>clearTimeout(timer);}},[state.pending,state.room,sync]);
 const setProfile=useCallback((profile:Profile)=>commit(s=>({...s,profile})),[commit]);
 const setName=useCallback((value:string)=>{const name=value.trim().slice(0,30)||'Ich';commit(s=>({...s,name,pending:s.room?[...s.pending,{id:crypto.randomUUID(),room:s.room,action:'rename',name}]:s.pending}));},[commit]);
 const toggleFavorite=useCallback((id:string)=>{commit(s=>{const profile=s.profile,selected=!s.favorites[profile].includes(id);return {...s,favorites:{...s.favorites,[profile]:selected?[...s.favorites[profile],id]:s.favorites[profile].filter(v=>v!==id)},pending:s.room?[...s.pending,{id:crypto.randomUUID(),room:s.room,action:'favorite',profile,sessionId:id,selected}]:s.pending};});if(ref.current.room)setSyncStatus(navigator.onLine?'syncing':'offline');},[commit]);
 const createRoom=useCallback(async()=>{setSyncStatus('syncing');setError(null);try{const current=ref.current;const data=await request(null,{action:'create',name:current.name,favorites:current.favorites});if(!data.room)throw new Error('Der Einladungslink konnte nicht erstellt werden.');commit(s=>({...s,...overlay(data,[],data.room!),room:data.room!}));setSyncStatus('synced');}catch(e){const msg=e instanceof Error?e.message:'Plan konnte nicht erstellt werden.';setError(msg);setSyncStatus('error');throw new Error(msg);}},[commit]);
 const joinRoom=useCallback(async(room:string)=>{setSyncStatus('syncing');setError(null);try{if(!/^[\w-]{43}$/.test(room))throw new Error('Der Einladungslink ist ungültig.');const data=await request(room);commit(s=>({...s,...overlay(data,s.pending,room),room}));history.replaceState(null,'',location.pathname+location.search+'#room='+room);setSyncStatus('synced');}catch(e){const msg=e instanceof Error?e.message:'Plan konnte nicht geladen werden.';setError(msg);setSyncStatus(ref.current.room?'error':'local');throw new Error(msg);}},[commit]);
 const leaveRoom=useCallback(()=>{commit(s=>({...s,room:null}));history.replaceState(null,'',location.pathname+location.search);setSyncStatus('local');setError(null);},[commit]);
 return {profile:state.profile,setProfile,name:state.name,setName,favorites:state.favorites,toggleFavorite,room:state.room,createRoom,joinRoom,leaveRoom,shareUrl:state.room?location.origin+location.pathname+'#room='+state.room:null,syncStatus,error,retry:()=>void sync()};
}
