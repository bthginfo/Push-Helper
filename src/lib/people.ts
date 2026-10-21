import type { Profile, RoomData } from './types';

export const PROFILES: readonly Profile[] = ['you', 'daniel', 'tobi'];
export const profileName = (profile: Profile, ownerName = 'Julius') => profile === 'you' ? ownerName : profile === 'daniel' ? 'Daniel' : 'Tobi';
export const isProfile = (value: unknown): value is Profile => PROFILES.includes(value as Profile);

export function normalizeFavorites(value: unknown): RoomData['favorites'] {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const read = (profile: Profile) => Array.isArray(source[profile])
    ? [...new Set((source[profile] as unknown[]).filter((id): id is string => typeof id === 'string'))].slice(0, 100) : [];
  return { you: read('you'), daniel: read('daniel'), tobi: read('tobi') };
}
