import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvitation, parseInvitation, isRoomKey } from '../src/lib/invitation';
import { normalizeFavorites } from '../src/lib/people';
import { plannerRequest } from '../src/lib/plannerRequest';

const room = 'a'.repeat(43);
test('existing two-person plans retain every selection and gain independent Tobi and Rafi selections', () => {
  const legacy = { you: ['keynote', 'breakout'], daniel: ['keynote'] };
  const result = normalizeFavorites(legacy);
  assert.deepEqual(result, { ...legacy, tobi: [], rafi: [] });
  result.you.push('networking'); result.tobi.push('roundtable');
  assert.deepEqual(legacy, { you: ['keynote', 'breakout'], daniel: ['keynote'] });
  assert.deepEqual(normalizeFavorites({ tobi: ['talk', null, 'talk'] }).tobi, ['talk']);
});

test('legacy invitations and person-specific invitations address the same plan', () => {
  assert.deepEqual(parseInvitation(`https://push-helper.vercel.app/#room=${room}`), { room });
  assert.deepEqual(parseInvitation(`https://push-helper.vercel.app/?room=${room}&profile=tobi`), { room, profile: 'tobi' });
  assert.deepEqual(parseInvitation(buildInvitation(room, 'rafi')), { room, profile: 'rafi' });
  assert.deepEqual(parseInvitation(buildInvitation(room, 'tobi')), { room, profile: 'tobi' });
  assert.equal(new URL(buildInvitation(room, 'daniel')).origin, 'https://push-helper.vercel.app');
  assert.deepEqual(parseInvitation(room), { room });
  assert.equal(parseInvitation('https://push-helper.vercel.app/'), null);
  assert.equal(isRoomKey('incomplete'), false);
});

test('temporary server failures are retried and legacy responses migrate before rendering', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ error: 'Temporary failure' }, { status: 503 })
    : Response.json({ name: 'Julius', favorites: { you: ['saved'], daniel: ['also-saved'] }, version: 'v1' });
  try {
    const data = await plannerRequest(room);
    assert.equal(calls, 2);
    assert.deepEqual(data.messages, []);
    assert.deepEqual(data.favorites, { you: ['saved'], daniel: ['also-saved'], tobi: [], rafi: [] });
  } finally { globalThis.fetch = original; }
});

test('creation is never replayed and permanent access failures are not retried', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: 'Unavailable' }, { status: 503 }); };
  try {
    await assert.rejects(plannerRequest(null, { action: 'create' }), /Unavailable/);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; return Response.json({ error: 'Not found' }, { status: 404 }); };
    await assert.rejects(plannerRequest(room), /Not found/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('existing three-person favorites and Rafi selections are independently preserved', () => {
  const existing = { you: ['a'], daniel: ['b'], tobi: ['c'] };
  const migrated = normalizeFavorites(existing);
  assert.deepEqual(migrated, { ...existing, rafi: [] });
  migrated.rafi.push('d');
  assert.deepEqual(existing, { you: ['a'], daniel: ['b'], tobi: ['c'] });
  assert.deepEqual(normalizeFavorites(migrated).rafi, ['d']);
});
