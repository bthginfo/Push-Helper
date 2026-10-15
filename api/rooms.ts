import {get,put,BlobPreconditionFailedError}from '@vercel/blob';
import {createHash,randomBytes,randomUUID}from 'node:crypto';
import type {IncomingMessage,ServerResponse}from 'node:http';
import program from '../src/data/program.json' with {type:'json'};
import type {Profile,RoomData}from '../src/lib/types';

const ids=new Set(program.sessions.map(s=>s.id));
const keyPattern=/^[A-Za-z0-9_-]{43}$/;
const pathFor=(key:string)=>'rooms/'+createHash('sha256').update(key).digest('hex')+'.json';
const requests=new Map<string,{at:number,count:number}>();
type Request=IncomingMessage&{body?:unknown};
class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
const result=(res:ServerResponse,status:number,data:unknown)=>{res.statusCode=status;res.end(JSON.stringify(data));};
export async function readRoom(key:string){
 const blob=await get(pathFor(key),{access:'private',useCache:false});
 if(!blob||blob.statusCode!==200)throw new ApiError(404,'Dieser Plan wurde nicht gefunden. Prüfe deinen Einladungslink.');
 return {data:JSON.parse(await new Response(blob.stream).text())as RoomData,etag:blob.blob.etag};
}
export default async function handler(req:Request,res:ServerResponse){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)throw new ApiError(403,'Diese Anfrage ist nicht erlaubt.');
  if(!['GET','POST'].includes(req.method||'')){res.setHeader('Allow','GET, POST');throw new ApiError(405,'Methode nicht unterstützt.');}
  if(!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)throw new ApiError(503,'Die Synchronisierung ist noch nicht eingerichtet. Deine Auswahl bleibt auf diesem Gerät.');
  const key=req.headers['x-room-key'];
  if(req.method==='GET'){
   if(typeof key!=='string'||!keyPattern.test(key))throw new ApiError(400,'Der Einladungslink ist ungültig.');
   return result(res,200,(await readRoom(key)).data);
  }
  if(Number(req.headers['content-length']||0)>12_000)throw new ApiError(413,'Die Anfrage ist zu groß.');
  let body=req.body;
  if(typeof body==='string')body=JSON.parse(body);
  if(!body||typeof body!=='object')throw new ApiError(400,'Die Anfrage ist unvollständig.');
  if(JSON.stringify(body).length>12_000)throw new ApiError(413,'Die Anfrage ist zu groß.');
  const b=body as Record<string,unknown>;
  if(b.action==='create'){
   const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0];
   const now=Date.now(),counter=requests.get(ip);if(counter&&now-counter.at<3_600_000&&counter.count>=5)throw new ApiError(429,'Bitte warte etwas, bevor du einen weiteren Plan erstellst.');
   if(!counter||now-counter.at>=3_600_000)requests.set(ip,{at:now,count:1});else counter.count++;
   if(requests.size>1000)requests.clear();
   const room=randomBytes(32).toString('base64url');
   const favorites={you:[]as string[],daniel:[]as string[]};
   for(const profile of ['you','daniel']as const){const incoming=(b.favorites as Record<string,unknown>)?.[profile];if(Array.isArray(incoming))favorites[profile]=[...new Set(incoming.filter((v):v is string=>typeof v==='string'&&ids.has(v)))].slice(0,100);}
   const data:RoomData={name:typeof b.name==='string'?b.name.trim().slice(0,30)||'Ich':'Ich',favorites,version:randomUUID()};
   await put(pathFor(room),JSON.stringify(data),{access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60});
   return result(res,201,{room,...data});
  }
  if(typeof key!=='string'||!keyPattern.test(key))throw new ApiError(400,'Der Einladungslink ist ungültig.');
  if(b.action!=='favorite'&&b.action!=='rename')throw new ApiError(400,'Unbekannte Aktion.');
  if(b.action==='favorite'&&(!['you','daniel'].includes(String(b.profile))||typeof b.sessionId!=='string'||!ids.has(b.sessionId)||typeof b.selected!=='boolean'))throw new ApiError(400,'Diese Session oder Person ist ungültig.');
  if(b.action==='rename'&&(typeof b.name!=='string'||!b.name.trim()||b.name.length>30))throw new ApiError(400,'Bitte verwende einen Namen mit 1 bis 30 Zeichen.');
  for(let attempt=0;attempt<4;attempt++){
   const {data,etag}=await readRoom(key);
   if(b.action==='rename')data.name=(b.name as string).trim();
   else{const p=b.profile as Profile,id=b.sessionId as string;data.favorites[p]=b.selected?[...new Set([...data.favorites[p],id])]:data.favorites[p].filter(v=>v!==id);}
   data.version=randomUUID();
   try{await put(pathFor(key),JSON.stringify(data),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',cacheControlMaxAge:60});return result(res,200,data);}
   catch(e){if(e instanceof BlobPreconditionFailedError&&attempt<3)continue;throw e;}
  }
 }catch(e){
  if(e instanceof ApiError)return result(res,e.status,{error:e.message});
  if(e instanceof SyntaxError)return result(res,400,{error:'Die Anfrage konnte nicht gelesen werden.'});
  console.error('Planner request failed',e instanceof Error?e.name:'UnknownError');
  result(res,503,{error:'Der gemeinsame Plan ist gerade nicht erreichbar. Deine Auswahl bleibt gespeichert. Bitte erneut versuchen.'});
 }
}
