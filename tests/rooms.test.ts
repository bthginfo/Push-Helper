import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import handler from '../api/rooms';

test('a plan large enough to be compressed remains writable without losing other selections', async () => {
  const program = JSON.parse(readFileSync(new URL('../src/data/program.json', import.meta.url), 'utf8'));
  const choices = program.sessions.slice(0, 20).map((session: { id: string }) => session.id);
  let stored = { name: 'Regression', favorites: { you: choices, daniel: choices.slice(0, 5), tobi: [] as string[] }, version: 'old' };
  assert.ok(JSON.stringify(stored).length > 1024);
  const strongETag = '"storage-version"';
  const originalDispatcher = getGlobalDispatcher();
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_faketoken';
  let writes = 0;
  // An HTTP intermediary weakens validators when it transforms a representation.
  const reads = mockAgent.get('https://teststore.private.blob.vercel-storage.com');
  reads.intercept({ method: 'GET', path: /.*/, headers: { 'accept-encoding': 'identity' } }).reply(200, () => stored, { headers: { etag: strongETag } }).persist();
  reads.intercept({ method: 'GET', path: /.*/ }).reply(200, () => stored, { headers: { etag: 'W/' + strongETag } }).persist();
  const pool = mockAgent.get('https://vercel.com');
  pool.intercept({ method: 'PUT', path: /.*/, headers: { 'x-if-match': strongETag } }).reply(200, options => {
    stored = JSON.parse(String(options.body)); writes++;
    return { url: 'https://teststore.private.blob.vercel-storage.com/room.json', pathname: 'room.json', etag: '"new-version"' };
  });
  pool.intercept({ method: 'PUT', path: /.*/ }).reply(412, { error: { code: 'precondition_failed', message: 'ETag mismatch' } }).persist();
  let status = 0, output = '';
  const response = { setHeader() {}, set statusCode(value: number) { status = value; }, end(value: string) { output = value; } };
  try {
    await handler({ method: 'POST', headers: { 'x-room-key': 'a'.repeat(43) }, body: {
      action: 'favorite', profile: 'tobi', sessionId: choices[0], selected: true,
    } } as unknown as IncomingMessage, response as unknown as ServerResponse);
    assert.equal(status, 200, output);
    assert.equal(writes, 1);
    assert.deepEqual(stored.favorites.you, choices);
    assert.deepEqual(stored.favorites.daniel, choices.slice(0, 5));
    assert.deepEqual(stored.favorites.tobi, [choices[0]]);
  } finally {
    setGlobalDispatcher(originalDispatcher);
    await mockAgent.close();
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  }
});

// Exercise the real route and Blob client against conditional storage responses.
async function withStorage(run: (call: (body?: Record<string, unknown>, key?: string) => Promise<{ status: number; data: any }>, stored: () => any, writes: () => number) => Promise<void>) {
  const { randomUUID } = await import('node:crypto');
  let stored: any = { name: 'Julius', favorites: { you: ['legacy'], daniel: [], tobi: ['unchanged'] }, version: 'legacy' };
  let etag = '"initial"', writes = 0;
  const originalDispatcher = getGlobalDispatcher(), mockAgent = new MockAgent();
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  mockAgent.disableNetConnect(); setGlobalDispatcher(mockAgent);
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_faketoken';
  mockAgent.get('https://teststore.private.blob.vercel-storage.com').intercept({ method: 'GET', path: /.*/, headers: { 'accept-encoding': 'identity' } }).reply(() => ({ statusCode: 200, data: JSON.stringify(stored), responseOptions: { headers: { etag } } })).persist();
  mockAgent.get('https://vercel.com').intercept({ method: 'PUT', path: /.*/ }).reply(options => {
    const headers = options.headers as Record<string, string>;
    if (headers['x-if-match'] && headers['x-if-match'] !== etag) return { statusCode: 412, data: { error: { code: 'precondition_failed', message: 'Another attendee wrote first' } } };
    stored = JSON.parse(String(options.body)); etag = '"' + randomUUID() + '"'; writes++;
    return { statusCode: 200, data: { url: 'https://teststore.private.blob.vercel-storage.com/room.json', pathname: 'room.json', etag } };
  }).persist();
  const call = async (body?: Record<string, unknown>, key: string = 'a'.repeat(43)) => {
    let status = 0, output = '';
    const response = { setHeader() {}, set statusCode(value: number) { status = value; }, end(value: string) { output = value; } };
    await handler({ method: body ? 'POST' : 'GET', headers: { 'x-room-key': key }, body } as unknown as IncomingMessage, response as unknown as ServerResponse);
    return { status, data: JSON.parse(output) };
  };
  try { await run(call, () => stored, () => writes); }
  finally { setGlobalDispatcher(originalDispatcher); await mockAgent.close(); if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = originalToken; }
}

test('Rafi joins legacy plans, chat sends are idempotent, and favorite updates preserve messages', async () => {
  const { randomUUID } = await import('node:crypto');
  const id = randomUUID();
  await withStorage(async (call, stored, writes) => {
    const migrated = await call();
    assert.equal(migrated.status, 200);
    assert.deepEqual(migrated.data.favorites.rafi, []);
    assert.deepEqual(migrated.data.messages, []);
    const sent = await call({ action: 'message', id, profile: 'rafi', text: '  Wir treffen uns im Foyer.  ' });
    assert.equal(sent.status, 200);
    assert.equal(sent.data.messages[0].text, 'Wir treffen uns im Foyer.');
    assert.equal(sent.data.messages[0].profile, 'rafi');
    assert.ok(Number.isFinite(Date.parse(sent.data.messages[0].createdAt)));
    const replayed = await call({ action: 'message', id, profile: 'rafi', text: 'Wir treffen uns im Foyer.' });
    assert.equal(replayed.status, 200);
    assert.equal(replayed.data.messages.length, 1);
    assert.equal(writes(), 1);
    const conflictingId = await call({ action: 'message', id, profile: 'you', text: 'Anderer Inhalt' });
    assert.equal(conflictingId.status, 409);
    const program = JSON.parse(readFileSync(new URL('../src/data/program.json', import.meta.url), 'utf8'));
    const favorite = await call({ action: 'favorite', profile: 'rafi', sessionId: program.sessions[0].id, selected: true });
    assert.equal(favorite.status, 200);
    assert.deepEqual(favorite.data.favorites.rafi, [program.sessions[0].id]);
    assert.equal(stored().messages.length, 1);
    assert.deepEqual(stored().favorites.you, ['legacy']);
    assert.deepEqual(stored().favorites.tobi, ['unchanged']);
  });
});

test('simultaneous chat sends and favorites merge through ETag retries without lost changes', async () => {
  const { randomUUID } = await import('node:crypto');
  await withStorage(async (call, stored) => {
    const program = JSON.parse(readFileSync(new URL('../src/data/program.json', import.meta.url), 'utf8'));
    const results = await Promise.all([
      call({ action: 'message', id: randomUUID(), profile: 'you', text: 'Treffen?' }),
      call({ action: 'message', id: randomUUID(), profile: 'rafi', text: 'Im Foyer!' }),
      call({ action: 'favorite', profile: 'rafi', sessionId: program.sessions[0].id, selected: true }),
    ]);
    for (const response of results) assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(stored().messages.length, 2);
    assert.deepEqual(new Set(stored().messages.map((message: { text: string }) => message.text)), new Set(['Treffen?', 'Im Foyer!']));
    assert.deepEqual(stored().favorites.rafi, [program.sessions[0].id]);
  });
});

test('chat rejects invalid keys, profiles, IDs, blank messages and oversized messages before writing', async () => {
  const { randomUUID } = await import('node:crypto');
  await withStorage(async (call, _stored, writes) => {
    const valid = { action: 'message', id: randomUUID(), profile: 'rafi', text: 'Hallo' };
    assert.equal((await call(valid, 'invalid')).status, 400);
    for (const change of [{ id: 'invalid' }, { profile: 'other' }, { text: '   ' }, { text: 'a'.repeat(1001) }]) {
      assert.equal((await call({ ...valid, ...change })).status, 400);
    }
    assert.equal(writes(), 0);
  });
});
