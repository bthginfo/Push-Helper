import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Session } from '../src/lib/types';
import { minutesToSession, nextPersonalStop, personalStop, sessionPlace } from '../src/lib/venue';

const sessions = JSON.parse(readFileSync(new URL('../src/data/program.json', import.meta.url), 'utf8')).sessions as Session[];
const at = (time: string, day = '2026-10-22') => new Date(`${day}T${time}:00+02:00`);
const breakout = (room: number, day = '2026-10-22', start = '12:15') => sessions.find(session => session.day === day && session.start === start && session.room === `Room ${room}`)!;

test('each profile’s favorite determines its own breakout target, with exact start/end boundaries', () => {
  for (const room of [1, 2, 6]) {
    const choice = breakout(room);
    const stop = personalStop(sessions, [choice.id], at('12:15'));
    assert.deepEqual(stop.sessions.map(session => session.id), [choice.id]);
    assert.equal(stop.phase, 'live');
    assert.equal(stop.personal, true);
    assert.equal(sessionPlace(stop.sessions[0])?.place.id, `breakout-${room}`);
    assert.equal(personalStop(sessions, [choice.id], at('12:14')).phase, 'upcoming');
    assert.equal(personalStop(sessions, [choice.id], at('13:30')).sessions[0].type, 'Pause');
  }
});

test('unselected parallel options stay undecided; conflicting favorites retain all destinations', () => {
  const undecided = personalStop(sessions, [], at('12:30'));
  assert.equal(undecided.sessions.length, 7);
  assert.equal(undecided.needsChoice, true);
  assert.equal(undecided.conflict, false);
  assert.ok(undecided.sessions.every(session => session.group === 'A'));
  const conflict = personalStop(sessions, [breakout(2).id, breakout(5).id], at('12:30'));
  assert.equal(conflict.conflict, true);
  assert.deepEqual(conflict.sessions.map(session => session.room), ['Room 2', 'Room 5']);
});

test('Group A lunch remains the default while B is in sessions; optional roundtables require a favorite', () => {
  for (const time of ['13:30', '13:45', '14:00', '14:29', '14:30', '14:59']) {
    const stop = personalStop(sessions, [], at(time));
    assert.equal(stop.sessions.length, 1);
    assert.equal(stop.sessions[0].type, 'Pause');
    assert.equal(stop.sessions[0].group, 'A');
    assert.equal(sessionPlace(stop.sessions[0])?.approximate, true);
  }
  const roundtable = sessions.find(session => session.day === '2026-10-22' && session.type === 'Roundtable' && session.start === '14:00')!;
  const stop = personalStop(sessions, [roundtable.id], at('14:00'));
  assert.equal(stop.sessions[0].id, roundtable.id);
  assert.equal(sessionPlace(stop.sessions[0])?.place.floor, 'upstairs');
  assert.equal(personalStop(sessions, [roundtable.id], at('14:30')).sessions[0].type, 'Pause');
  assert.equal(personalStop(sessions, [], at('15:00')).sessions[0].room, 'Main Stage');
});

test('an explicitly selected Group B session overrides Group A lunch and appears as the next stop', () => {
  const choice = breakout(6, '2026-10-22', '13:45');
  assert.equal(nextPersonalStop(sessions, [choice.id], at('13:35')).sessions[0].id, choice.id);
  const stop = personalStop(sessions, [choice.id], at('14:00'));
  assert.deepEqual(stop.sessions.map(session => session.id), [choice.id]);
});

test('main stage, breaks, before/after the conference and overnight remain time-aware on both days', () => {
  for (const day of ['2026-10-22', '2026-10-23']) {
    assert.equal(personalStop(sessions, [], at('10:00', day)).sessions[0].room, 'Main Stage');
    assert.equal(personalStop(sessions, [], at('16:00', day)).sessions[0].type, 'Pause');
    assert.equal(personalStop(sessions, [], at('16:30', day)).sessions[0].room, 'Main Stage');
  }
  const before = personalStop(sessions, [], at('08:00', '2026-10-21'));
  assert.equal(before.phase, 'upcoming');
  assert.equal(before.sessions[0].day, '2026-10-22');
  const overnight = personalStop(sessions, [], at('22:00'));
  assert.equal(overnight.phase, 'upcoming');
  assert.equal(overnight.sessions[0].day, '2026-10-23');
  assert.equal(personalStop(sessions, [], at('18:15', '2026-10-23')).phase, 'ended');
  assert.equal(personalStop(sessions, [], at('10:00', '2026-10-24')).sessions.length, 0);
});

test('room mapping follows the supplied plan without assigning unknown rooms or table positions', () => {
  for (const day of ['2026-10-22', '2026-10-23']) {
    for (const room of [1, 2, 3, 4, 5, 6]) {
      const location = sessionPlace(breakout(room, day));
      assert.equal(location?.place.id, `breakout-${room}`);
      assert.equal(location?.place.area, room <= 4 ? 'Seitenflügel' : 'Restaurant');
    }
  }
  assert.equal(sessionPlace({ ...breakout(1), room: 'Unbekannter Raum' }), null);
  assert.equal(sessionPlace({ ...breakout(1), room: 'Room 7' }), null);
  const roundtables = sessions.filter(session => session.type === 'Roundtable');
  assert.ok(roundtables.every(session => sessionPlace(session)?.place.id === 'roundtables'));
});

test('countdown uses conference time, independent of device timezone and across midnight', () => {
  const target = breakout(1);
  assert.equal(minutesToSession(target, new Date('2026-10-22T10:00:00Z')), 15);
  assert.equal(minutesToSession(target, at('23:45', '2026-10-21')), 750);
});
