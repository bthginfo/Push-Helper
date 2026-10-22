import type { Session } from './types';
import { conferenceNow, sessionState } from './time';

export type PlaceId = 'main' | 'breakout-1' | 'breakout-2' | 'breakout-3' | 'breakout-4' | 'breakout-5' | 'breakout-6' | 'foyer' | 'lounge' | 'roundtables' | 'toilets' | 'yard';
export type Floor = 'ground' | 'upstairs';
export interface Place { id: PlaceId; name: string; floor: Floor; area: string; directions: string }
export const places: Place[] = [
  { id: 'main', name: 'Main Stage', floor: 'ground', area: 'Auditorium', directions: 'Vom Eingang durch das Foyer geradeaus in den großen Saal.' },
  { id: 'breakout-1', name: 'Breakout #1', floor: 'ground', area: 'Seitenflügel', directions: 'Vom Foyer am Saal entlang zum linken Seitenflügel. Raum #1 liegt ganz außen am linken Ende.' },
  { id: 'breakout-2', name: 'Breakout #2', floor: 'ground', area: 'Seitenflügel', directions: 'Im linken Seitenflügel liegt Raum #2 auf der oberen Seite des Gangs, zwischen #1 und #3.' },
  { id: 'breakout-3', name: 'Breakout #3', floor: 'ground', area: 'Seitenflügel', directions: 'Im linken Seitenflügel liegt Raum #3 auf der oberen Seite des Gangs, näher am Hauptsaal.' },
  { id: 'breakout-4', name: 'Breakout #4', floor: 'ground', area: 'Seitenflügel', directions: 'Im linken Seitenflügel liegt Raum #4 auf der unteren Seite des Gangs, gegenüber von #3.' },
  { id: 'breakout-5', name: 'Breakout #5', floor: 'ground', area: 'Restaurant', directions: 'Rechts vom Hauptsaal zum Restaurant. Raum #5 liegt links neben #6.' },
  { id: 'breakout-6', name: 'Breakout #6', floor: 'ground', area: 'Restaurant', directions: 'Rechts vom Hauptsaal zum Restaurant. Raum #6 liegt rechts neben #5.' },
  { id: 'foyer', name: 'Foyer', floor: 'ground', area: 'Eingang · Buffet 1', directions: 'Direkt hinter dem Eingang vom öffentlichen Platz. Buffet 1 liegt links, die Treppe zum Obergeschoss rechts.' },
  { id: 'lounge', name: 'Lounge & Networking', floor: 'upstairs', area: 'Foyer im Obergeschoss', directions: 'Im Foyer rechts die Treppe nach oben nehmen. Lounge, Buffet 2 und Arcade liegen im oberen Foyer.' },
  { id: 'roundtables', name: 'Roundtables', floor: 'upstairs', area: 'Foyer im Obergeschoss', directions: 'Im Foyer rechts die Treppe nach oben nehmen. Der Roundtable-Bereich liegt oben rechts. Die Tischnummer steht bei deiner Session.' },
  { id: 'toilets', name: 'Toiletten', floor: 'ground', area: 'Rechts neben dem Foyer', directions: 'Vom Foyer rechts neben der Treppe, unterhalb des Innenhofs.' },
  { id: 'yard', name: 'Innenhof', floor: 'ground', area: 'Rechts vom Hauptsaal', directions: 'Der Innenhof liegt rechts neben dem Hauptsaal, oberhalb der Toiletten.' },
];
export const placeById = (id: PlaceId) => places.find(place => place.id === id)!;

export function sessionPlace(session: Session): { place: Place; approximate: boolean } | null {
  const breakout = /^(?:Room|Breakout\s*#?)\s*([1-6])$/i.exec(session.room.trim());
  if (breakout) return { place: placeById(`breakout-${breakout[1]}` as PlaceId), approximate: false };
  if (session.room === 'Main Stage') return { place: placeById('main'), approximate: false };
  if (session.type === 'Roundtable' && /^Roundtable/.test(session.room)) return { place: placeById('roundtables'), approximate: false };
  if (/upstairs|obergeschoss|lounge/i.test(session.room)) return { place: placeById('lounge'), approximate: false };
  if (session.room === 'Foyer') return { place: placeById('foyer'), approximate: false };
  // General venue entries have no assigned room; the foyer is an orientation suggestion only.
  if (session.room === 'Alte Kongresshalle' && (session.type === 'Pause' || session.type === 'Networking' || /einlass|check-in/i.test(session.title))) {
    return { place: placeById('foyer'), approximate: true };
  }
  return null;
}

export interface PersonalStop { phase: 'live' | 'upcoming' | 'ended'; sessions: Session[]; needsChoice: boolean; conflict: boolean; personal: boolean }
const byTime = (a: Session, b: Session) => (a.day + a.start).localeCompare(b.day + b.start);
const isDefault = (session: Session) => !session.group || (session.group === 'A' && session.type !== 'Roundtable');

function resolveOptions(candidates: Session[], favorites: Set<string>, phase: 'live' | 'upcoming'): PersonalStop {
  const selected = candidates.filter(session => favorites.has(session.id));
  const options = selected.length ? selected : candidates.filter(isDefault);
  // Group A's programme takes precedence over the other group's simultaneous lunch.
  const activities = options.filter(session => session.type !== 'Pause');
  const result = activities.length ? activities : options;
  return { phase, sessions: result, needsChoice: result.length > 1, conflict: selected.length > 1 && result.length > 1, personal: selected.length > 0 };
}

export function nextPersonalStop(sessions: Session[], favoriteIds: string[], now = new Date()): PersonalStop {
  const favorites = new Set(favoriteIds);
  const upcoming = sessions.filter(session => sessionState(session, now) === 'upcoming' && (isDefault(session) || favorites.has(session.id))).sort(byTime);
  if (!upcoming.length) return { phase: 'ended', sessions: [], needsChoice: false, conflict: false, personal: false };
  const first = upcoming[0];
  return resolveOptions(upcoming.filter(session => session.day === first.day && session.start === first.start), favorites, 'upcoming');
}

export function personalStop(sessions: Session[], favoriteIds: string[], now = new Date()): PersonalStop {
  const favorites = new Set(favoriteIds);
  const live = sessions.filter(session => sessionState(session, now) === 'live' && (isDefault(session) || favorites.has(session.id)));
  if (live.length) return resolveOptions(live, favorites, 'live');
  return nextPersonalStop(sessions, favoriteIds, now);
}

export function minutesToSession(session: Session, now: Date): number {
  const current = conferenceNow(now);
  const localDay = Date.parse(current.day + 'T00:00:00Z');
  const targetDay = Date.parse(session.day + 'T00:00:00Z');
  const [hours, minutes] = session.start.split(':').map(Number);
  return (targetDay - localDay) / 60_000 + hours * 60 + minutes - current.minutes;
}
