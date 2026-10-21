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
