import { load } from 'cheerio';
import fs from 'node:fs/promises';
const base='https://push-conference.com';
const summaries=JSON.parse(await fs.readFile(new URL('./summaries.json',import.meta.url),'utf8'));
const $=load(await (await fetch(base+'/program')).text());
const detailCache=new Map();
async function detail(path){
 if(detailCache.has(path))return detailCache.get(path);
 const task=(async()=>{
 const d=load(await (await fetch(base+path)).text());
 const header=d('main section').first();
 const speakerRows=d('main section.flex.items-center').map((i,e)=>{
  const name=d(e).find('p').first().text();
  const role=d(e).find('p').eq(1).find('span').first().text();
  const company=d(e).find('p').eq(1).find('span').last().text();
  return {name,role,company,bio:`${name} · ${role}${company?' · '+company:''}`,image:new URL(d(e).find('img').first().attr('src')||'/favicon.ico',base).href};
 }).get();
 const speakers=[...new Map(speakerRows.filter(s=>(s.role&&!(s.name===s.role&&s.role===s.company))||s.name==='To be announced').map(s=>[s.name,s])).values()];
 return {title:d('h1').text(),type:header.text().startsWith('Keynote')?'Keynote':'Talk',speakers};
 })();detailCache.set(path,task);return task;
}
const sessions=[];
const slug=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const practical={
 'Doors Open & Check-In':['Einlass & Check-in','Organisation','Badge abholen, ankommen und die Location erkunden.','Der Konferenztag beginnt mit dem Check-in. Plane Zeit für dein Badge und die Orientierung vor dem ersten Talk ein.'],
 'Doors Open':['Einlass','Organisation','Ankommen und vor den ersten Talks entspannt Platz finden.','Die Türen öffnen um 09:30 Uhr. Das Bühnenprogramm beginnt um 10:00 Uhr.'],
 'PUSH Peers Networking Breakfast':['PUSH Peers Networking Breakfast','Networking','Frühstück und neue Kontakte für angemeldete PUSH-Peers-Gäste.','Die kostenlosen Plätze sind begrenzt. Die Anmeldung läuft über PUSH Peers; eine Markierung hier ersetzt sie nicht.'],
 'Coffee Break':['Kaffeepause','Pause','Zeit für Kaffee, Kuchen und Gespräche.','Nutze die halbe Stunde zum Durchatmen, für die Ausstellung oder zum Austausch mit anderen Gästen.'],
 'Get-Together & Networking':['Get-together & Networking','Networking','Den ersten Tag mit Drinks und Gesprächen im Foyer ausklingen lassen.','Der offizielle Ausklang findet im Foyer statt. Die Türen schließen um 20:00 Uhr.'],
 'End of PUSH UX 2026':['Abschluss & Abschied','Organisation','Gemeinsamer Abschluss der PUSH UX 2026.','Der Veranstalter plant das Ende gegen 18:15 Uhr.']
};
for(const [sectionId,day]of [['thu-22-oct','2026-10-22'],['fri-23-oct','2026-10-23']]){
 const section=$('#'+sectionId);
 const roots=section.find('article').filter((i,e)=>!$(e).parents('article').length);
 const starts=roots.map((i,e)=>$(e).find('time').first().text()).get().filter(Boolean);
 for(const el of section.find('article').toArray()){
  const a=$(el);if(a.find('article').length)continue;
  const parent=a.parents('article').first();
  const start=a.find('time').first().text()||parent.find('time').first().text();
  if(!/^\d\d:\d\d$/.test(start))throw new Error('Missing start time');
  const title=a.find('h3').first().text().replace(/\s+/g,' ').trim();
  const groupMatch=(parent.length?parent.find('h3').first().text():title).match(/Group ([AB])/);
  const group=groupMatch?.[1];
  const path=a.parent('a').attr('href');
  const sourceUrl=path?base+path:base+'/program#'+sectionId;
  const next=starts.find(t=>t>start)||'18:15';
  let s={id:`${day}-${a.attr('data-session-slug')||slug(title)}`,day,start,end:next,endEstimated:true,title,type:'Organisation',room:'Alte Kongresshalle',speakers:[],tldr:'',description:[],sourceUrl,tags:[],bookingRequired:false,...(group?{group}:{})};
  if(path){
   const d=await detail(path);const key=path.split('/').pop();
   const summary=summaries[key]||['Neue Session im offiziellen Programm.','Die ausführlichen Informationen findest du auf der Veranstalterseite.'];
   s={...s,type:group?'Breakout':d.type,room:group?(a.find('.smallcaps').first().text()||'Raum noch offen'):'Main Stage',speakers:d.speakers,tldr:summary[0],description:summary.slice(1),bookingRequired:!!group};
   if(group)s.end=group==='A'?'13:30':'15:00';
  }else if(parent.length){
   s.type='Lightning Talks';s.room='Main Stage';s.end=group==='A'?'13:30':'15:00';
   const items=[];
   for(const p of [...new Set(a.find('a[href^="/2026/"]').map((i,e)=>$(e).attr('href')).get())]){
    const d=await detail(p),summary=summaries[p.split('/').pop()];
    s.speakers.push(...d.speakers);items.push(`${d.title}: ${summary?.[0]||'Details auf der Veranstalterseite.'}`,summary?.[1]||'');
   }
   s.tldr=`Mehrere kompakte Vorträge zum Thema ${title}. Eine Alternative zu den parallelen Breakouts.`;s.description=items.filter(Boolean);s.bookingRequired=true;
  }else if(title.includes('Lunch Break')){
   s.title=`Mittagspause · Gruppe ${group}`;s.type='Pause';s.end=group==='B'?'13:45':'15:00';
   s.tldr=`Mittagessen für Gruppe ${group}: ${group==='B'?'vor dem Breakout um 13:45 Uhr':'nach dem Breakout um 12:15 Uhr'}.`;
   s.description=['Buffet, Ausstellung und Networking laufen parallel zum Breakout der jeweils anderen Gruppe. Die Gruppe richtet sich nach deiner offiziellen Breakout-Buchung. Roundtables sind eigene Einträge in der Agenda.'];
  }else{
   const info=practical[title];if(!info)throw new Error('Unknown practical item: '+title);
   [s.title,s.type,s.tldr]=info;s.description=[info[3]];
   if(title==='Get-Together & Networking'){s.end='20:00';s.endEstimated=false;s.room='Foyer';}
   if(title==='End of PUSH UX 2026')s.end='18:15';
   if(title==='PUSH Peers Networking Breakfast')s.bookingRequired=true;
  }
  const text=(s.title+' '+s.description.join(' ')).toLowerCase();
  s.tags=[...new Set([...(s.type==='Breakout'?['Hands-on']:[]),...(/\bai\b|\bki\b|agent|claude/.test(text)?['KI & Design']:[]),...(/research|discovery|insight/.test(text)?['Research']:[]),...(/leader|führung|organisation|team/.test(text)?['Leadership']:[]),...(/craft|produkt|product/.test(text)?['Product & Craft']:[]),...(text.includes('accessibility')||text.includes('barrierefrei')?['Accessibility']:[])])];
  sessions.push(s);
 }
}
const roundtables=[
 ['2026-10-22','12:45','1','What Makes Exceptional UX Different from Good UX?','Christoph Ortmann','Design & Business Strategy Consultant','CaderaDesign','Was unterscheidet außergewöhnliche UX von guter UX?'],
 ['2026-10-22','12:45','2','Redefining the Role of the Design Leader','Stan Reimgen','Sr. Design Lead','Qonto','Wie verändert sich die Rolle von Design Leadership?'],
 ['2026-10-22','14:00','1','Artificial Expectations: How Is AI Influencing Design Projects and Shifting What Stakeholders Expect?','Dennis Knopf','Director of Product','zigzag','Wie verändert KI die Erwartungen von Stakeholdern an Designprojekte?'],
 ['2026-10-22','14:00','2','Decision-Making for AI-Driven Products','Christiane Moser','UX Consultant','CUXpro','Gemeinsam über Entscheidungen für KI-Produkte diskutieren.'],
 ['2026-10-23','12:45','1','What Should We Never Delegate to AI?','Jason Giles','VP Customer Intelligence','UserTesting','Welche Aufgaben und Entscheidungen sollten wir nie an KI abgeben?'],
 ['2026-10-23','12:45','2','Originality in the Age of AI: How Taste, Craft, and Vision Set Products Apart.','Malvika Kasliwal','Associate Manager','Netlight','Wie Geschmack, Handwerk und Vision Produkte im KI-Zeitalter prägen.'],
 ['2026-10-23','14:00','1','Becoming Unfuckwithable: How Can We Build Resilience and Relevance In The Age of Uncertainty?','Akshan Ish','Senior Staff Product Designer','Miro','Über Resilienz und berufliche Relevanz in unsicheren Zeiten sprechen.'],
 ['2026-10-23','14:00','2','How Do Designers Communicate Their Value in the Age of AI','Ben Sauer','Coach, Author','Clouds and Clocks','Den eigenen Wert als Designer im KI-Zeitalter verständlich vermitteln.']
];
// Roundtable timing and hosts verified on the separate official format page.
const rt=load(await (await fetch(base+'/program/roundtable-discussions')).text());
for(const [day,start,table,title,name,role,company,tldr]of roundtables){
 if(!rt('main').text().replace(/\s+/g,' ').includes(title))throw new Error('Roundtable source changed: '+title);
 const end=start==='12:45'?'13:15':'14:30';
 const image=rt(`img[alt="${name}"]`).attr('src');
 sessions.push({id:`${day}-roundtable-${start.replace(':','')}-${table}`,day,start,end,endEstimated:false,title,type:'Roundtable',room:`Roundtable · Tisch ${table}`,group:start==='12:45'?'B':'A',speakers:[{name,role,company,bio:`${name} · ${role} · ${company}`,image:image?new URL(image,base).href:''}],tldr,description:['Moderierter Austausch mit bis zu zehn Personen, ohne Folien und ohne Aufzeichnung. Jede Runde dauert 30 Minuten.','Morgens am Info Point anmelden. Spontanes Dazukommen ist möglich, wenn zum Start noch Plätze frei sind.'],sourceUrl:base+'/program/roundtable-discussions',tags:['Austausch'],bookingRequired:true});
}
sessions.sort((a,b)=>a.day.localeCompare(b.day)||a.start.localeCompare(b.start)||a.room.localeCompare(b.room));
const program={updatedAt:new Date().toISOString(),sourceUrl:base+'/program',sessions,venue:{name:'Alte Kongresshalle',address:'Am Bavariapark 14',city:'80339 München',mapsUrl:'https://www.google.com/maps/search/?api=1&query=Alte+Kongresshalle+Am+Bavariapark+14+Muenchen',sourceUrl:base+'/location',transit:['Vom Hauptbahnhof: U4 oder U5, laut Veranstalter etwa 15 Minuten.','Vom Flughafen: S1 oder S8 zum Hauptbahnhof, anschließend U-Bahn; insgesamt etwa 60 Minuten.'],floorplanUrl:null}};
await fs.mkdir(new URL('../src/data/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../src/data/program.json',import.meta.url),JSON.stringify(program,null,2)+'\n');
console.log(`Saved ${sessions.length} agenda entries (${new Set(sessions.filter(s=>s.type==='Breakout').map(s=>s.title)).size} unique breakouts).`);
