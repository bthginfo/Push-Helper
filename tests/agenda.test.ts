import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import type {Session}from '../src/lib/types';
import {conferenceNow,sessionState,getLiveSessions,getNextSession,findConflicts}from '../src/lib/time';
import {calendarText}from '../src/lib/calendar';
const program=JSON.parse(readFileSync(new URL('../src/data/program.json',import.meta.url),'utf8'));
const sessions=program.sessions as Session[];
test('official agenda has both days, unique IDs, valid times and all breakout rooms',()=>{
 assert.equal(sessions.length,63);assert.equal(new Set(sessions.map(s=>s.id)).size,sessions.length);
 for(const day of ['2026-10-22','2026-10-23']){
  const items=sessions.filter(s=>s.day===day);assert.ok(items.length>=30);
  for(const start of ['12:15','13:45'])assert.equal(items.filter(s=>s.type==='Breakout'&&s.start===start).length,6);
 }
 for(const s of sessions){assert.match(s.start,/^\d{2}:\d{2}$/);assert.ok(s.end>s.start,s.title);assert.ok(s.tldr);assert.ok(s.description.length);assert.ok(s.sourceUrl.startsWith('https://push-conference.com/'));assert.equal(s.speakers.length,new Set(s.speakers.map(p=>p.name)).size);}
});
test('Berlin clock and live boundaries are independent of device timezone',()=>{
 assert.deepEqual(conferenceNow(new Date('2026-10-22T08:00:00Z')),{day:'2026-10-22',time:'10:00',minutes:600});
 const keynote=sessions.find(s=>s.id.endsWith('simple-is-harder-than-ever'))!;
 assert.equal(sessionState(keynote,new Date('2026-10-22T07:59:59Z')),'upcoming');
 assert.equal(sessionState(keynote,new Date('2026-10-22T08:00:00Z')),'live');
 assert.equal(sessionState(keynote,new Date('2026-10-22T09:00:00Z')),'ended');
 assert.equal(getLiveSessions(sessions,new Date('2026-10-15T10:00:00Z')).length,0);
 assert.equal(getLiveSessions(sessions,new Date('2026-10-22T10:30:00Z')).filter(s=>s.type==='Breakout').length,6);
 assert.equal(getNextSession(sessions,new Date('2026-10-23T21:00:00Z')),undefined);
});
test('overlapping attendance conflicts are detected but breaks do not create noise',()=>{
 const choices=sessions.filter(s=>s.day==='2026-10-22'&&s.start==='12:15');
 assert.equal(findConflicts(choices.slice(0,2)).length,1);
 assert.equal(findConflicts([choices[0],sessions.find(s=>s.type==='Pause')!]).length,0);
});
test('calendar export preserves local conference time, escaping and UTF-8 folding',()=>{
 const text=calendarText(sessions.slice(0,4));assert.ok(text.includes('TZID:Europe/Berlin'));assert.ok(text.includes('DTSTART;TZID=Europe/Berlin:20261022T100000'));assert.ok(text.endsWith('END:VCALENDAR\r\n'));
 for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const custom=calendarText([{...sessions[0],title:'Ä,;\\\n'.repeat(30)}]);assert.ok(custom.includes('\\,\\;\\\\\\n'));for(const line of custom.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
