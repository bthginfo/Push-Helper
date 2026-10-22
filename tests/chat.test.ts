import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isMessageText, mergeMessages, normalizeMessages, MAX_MESSAGES } from '../src/lib/chat';
import type { ChatMessage } from '../src/lib/types';

const message = (text = 'Treffen im Foyer'): ChatMessage => ({ id: randomUUID(), profile: 'rafi', text, createdAt: '2026-10-22T10:00:00Z' });

test('chat migration accepts four profiles and preserves plain text while rejecting malformed entries', () => {
  assert.deepEqual(normalizeMessages(undefined), []);
  const valid = message('<script>plain text</script>\nZweite Zeile');
  assert.deepEqual(normalizeMessages([valid, valid, null, { ...valid, id: randomUUID(), profile: 'unknown' }, { ...valid, id: randomUUID(), createdAt: 'invalid' }, { ...valid, id: randomUUID(), text: '' }]), [valid]);
  assert.equal(isMessageText('   '), false);
  assert.equal(isMessageText('a'.repeat(1001)), false);
  assert.equal(isMessageText('😀\nHallo Rafi'), true);
});

test('chat history retains the newest 200 messages without dropping optimistic queued messages', () => {
  const history = Array.from({ length: MAX_MESSAGES + 2 }, (_, index) => message(String(index)));
  const confirmed = normalizeMessages(history);
  assert.equal(confirmed.length, MAX_MESSAGES);
  assert.equal(confirmed[0].text, '2');
  const queued = message('Offline vorgemerkt');
  assert.deepEqual(mergeMessages(confirmed, [confirmed[0], queued]), [...confirmed, queued]);
  assert.deepEqual(mergeMessages([...confirmed, queued], [queued]), [...confirmed, queued]);
});
