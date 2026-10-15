import type {Session}from './types';
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const stamp=(day:string,time:string)=>day.replaceAll('-','')+'T'+time.replace(':','')+'00';
export function calendarText(sessions:Session[]){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PUSH Companion//Agenda 2026//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PUSH UX 2026','X-WR-TIMEZONE:Europe/Berlin','BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:20260329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:20261025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','END:STANDARD','END:VTIMEZONE'];
 for(const s of sessions)lines.push('BEGIN:VEVENT',`UID:${s.id}@push-helper.app`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;TZID=Europe/Berlin:${stamp(s.day,s.start)}`,`DTEND;TZID=Europe/Berlin:${stamp(s.day,s.end)}`,`SUMMARY:${escape(s.title)}`,`LOCATION:${escape(s.room+', Alte Kongresshalle München')}`,`DESCRIPTION:${escape(s.tldr+'\n'+(s.endEstimated?'Endzeit aus dem Programm abgeleitet, ohne Gewähr.\n':'')+(s.bookingRequired?'Vormerkung ersetzt keine offizielle Buchung.\n':'')+s.sourceUrl)}`,'STATUS:TENTATIVE','END:VEVENT');
 lines.push('END:VCALENDAR');
 // RFC 5545: fold by UTF-8 octets without splitting a code point.
 return lines.flatMap(line=>{const result:string[]=[];let part='';let bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>74){result.push(part);part=' '+ch;bytes=1+size;}else{part+=ch;bytes+=size;}}result.push(part);return result;}).join('\r\n')+'\r\n';
}
export function downloadCalendar(sessions:Session[],filename='push-ux-2026.ics'){
 const url=URL.createObjectURL(new Blob([calendarText(sessions)],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
