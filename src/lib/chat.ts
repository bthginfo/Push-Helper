import type { ChatMessage } from './types';
import { isProfile } from './people';

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_MESSAGES = 200;
export const isMessageId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export const isMessageText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_MESSAGE_LENGTH;

export function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((message): message is ChatMessage => {
    if (!message || !isMessageId(message.id) || seen.has(message.id) || !isProfile(message.profile)
      || !isMessageText(message.text) || typeof message.createdAt !== 'string' || !Number.isFinite(Date.parse(message.createdAt))) return false;
    seen.add(message.id); return true;
  }).slice(-MAX_MESSAGES).map(message => ({ id: message.id, profile: message.profile, text: message.text, createdAt: message.createdAt }));
}

/** Keep unacknowledged sends visible without duplicating a message already confirmed by the server. */
export function mergeMessages(confirmed: ChatMessage[], queued: ChatMessage[]): ChatMessage[] {
  const ids = new Set(confirmed.map(message => message.id));
  return [...confirmed, ...queued.filter(message => !ids.has(message.id))];
}
