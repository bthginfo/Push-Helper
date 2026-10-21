import type { Profile } from './types';
import { isProfile } from './people';

export interface Invitation { room: string; profile?: Profile }
export const PUBLIC_APP_URL = 'https://push-helper.vercel.app/';
export const isRoomKey = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function parseInvitation(input: string): Invitation | null {
  const value = input.trim();
  if (isRoomKey(value)) return { room: value };
  try {
    const url = new URL(value, PUBLIC_APP_URL);
    const hash = new URLSearchParams(url.hash.slice(1));
    const room = hash.get('room') || url.searchParams.get('room');
    if (!room) return null;
    const person = hash.get('person') || hash.get('profile') || url.searchParams.get('person') || url.searchParams.get('profile');
    return { room: room.trim(), ...(isProfile(person) ? { profile: person } : {}) };
  } catch { return null; }
}

export function buildInvitation(room: string, profile?: Profile): string {
  if (!isRoomKey(room)) throw new Error('Der Einladungslink enthält keinen gültigen Plan-Schlüssel.');
  const url = new URL(PUBLIC_APP_URL);
  url.hash = new URLSearchParams({ room, ...(profile ? { person: profile } : {}) }).toString();
  return url.href;
}

export function rememberRoomAddress(room: string | null, profile?: Profile) {
  const search = new URLSearchParams(location.search);
  for (const key of ['room', 'person', 'profile']) search.delete(key);
  const hash = room ? new URLSearchParams({ room, ...(profile ? { person: profile } : {}) }).toString() : '';
  history.replaceState(null, '', location.pathname + (search.size ? '?' + search : '') + (hash ? '#' + hash : ''));
}
