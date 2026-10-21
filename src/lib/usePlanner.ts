import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile, RoomData } from './types';
import { isProfile, normalizeFavorites } from './people';
import { buildInvitation, isRoomKey, rememberRoomAddress } from './invitation';
import { plannerRequest as request } from './plannerRequest';

type Operation = { id: string; room: string; action: 'favorite'; profile: Profile; sessionId: string; selected: boolean }
  | { id: string; room: string; action: 'rename'; name: string };
type Stored = { profile: Profile; name: string; favorites: RoomData['favorites']; room: string | null; pending: Operation[] };
type Status = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
const STORAGE = 'push-companion-planner-v1';
const empty = (): Stored => ({ profile: 'you', name: 'Julius', favorites: normalizeFavorites(null), room: null, pending: [] });

function load(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (!s) return empty();
    return { profile: isProfile(s.profile) ? s.profile : 'you',
      name: typeof s.name === 'string' && s.name !== 'Ich' ? s.name.slice(0, 30) : 'Julius',
      favorites: normalizeFavorites(s.favorites), room: isRoomKey(s.room) ? s.room : null,
      pending: Array.isArray(s.pending) ? s.pending.filter((op: Operation) => isRoomKey(op?.room)
        && (op.action === 'rename' || (op.action === 'favorite' && isProfile(op.profile)))).slice(0, 500) : [] };
  } catch { return empty(); }
}
function overlay(data: RoomData, pending: Operation[], room: string) {
  const result = { name: data.name, favorites: normalizeFavorites(data.favorites) };
  for (const op of pending.filter(item => item.room === room)) {
    if (op.action === 'rename') result.name = op.name;
    else result.favorites[op.profile] = op.selected ? [...new Set([...result.favorites[op.profile], op.sessionId])]
      : result.favorites[op.profile].filter(id => id !== op.sessionId);
  }
  return result;
}
const errorMessage = (error: unknown) => error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
  ? 'Das Laden dauert zu lange. Deine Auswahl ist gespeichert. Bitte erneut versuchen.'
  : error instanceof TypeError ? 'Keine Verbindung zum gemeinsamen Plan. Prüfe deine Internetverbindung und versuche es erneut.'
    : error instanceof Error ? error.message : 'Der gemeinsame Plan ist nicht erreichbar. Bitte erneut versuchen.';

export function usePlanner() {
  const [state, setState] = useState<Stored>(load);
  const ref = useRef(state);
  const [syncStatus, setSyncStatus] = useState<Status>(state.room ? 'syncing' : 'local');
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false), mounted = useRef(true);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const commit = useCallback((change: (value: Stored) => Stored) => {
    const next = change(ref.current); ref.current = next; setState(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); }
    catch { setError('Auf diesem Gerät ist kein Speicher frei. Halte die App bis zur Synchronisierung geöffnet.'); }
  }, []);
  const sync = useCallback(async () => {
    const room = ref.current.room;
    if (!room || running.current) return;
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    running.current = true; setSyncStatus('syncing');
    let succeeded = false;
    try {
      let op: Operation | undefined;
      while ((op = ref.current.pending.find(item => item.room === room)) && ref.current.room === room) {
        const sent = op, data = await request(room, sent);
        if (!mounted.current) return;
        commit(current => { const pending = current.pending.filter(item => item.id !== sent.id);
          return current.room === room ? { ...current, ...overlay(data, pending, room), pending } : { ...current, pending }; });
      }
      const data = await request(room);
      if (mounted.current && ref.current.room === room) {
        commit(current => ({ ...current, ...overlay(data, current.pending, room) }));
        setSyncStatus(ref.current.pending.some(op => op.room === room) ? 'syncing' : 'synced');
        setError(null); succeeded = true;
      }
    } catch (failure) {
      if (mounted.current && ref.current.room === room) { setSyncStatus(navigator.onLine ? 'error' : 'offline'); setError(errorMessage(failure)); }
    } finally {
      running.current = false;
      if (succeeded && mounted.current && ref.current.room === room && ref.current.pending.some(op => op.room === room)) {
        setTimeout(() => { if (mounted.current) void syncRef.current(); }, 450);
      }
    }
  }, [commit]);
  useEffect(() => { syncRef.current = sync; }, [sync]);
  useEffect(() => {
    mounted.current = true; void sync();
    const refresh = () => { if (document.visibilityState === 'visible') void sync(); };
    const offline = () => setSyncStatus(ref.current.room ? 'offline' : 'local');
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('online', refresh); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', refresh);
    return () => { mounted.current = false; clearInterval(interval); window.removeEventListener('online', refresh);
      window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', refresh); };
  }, [sync, state.room]);
  useEffect(() => { if (state.room && state.pending.some(op => op.room === state.room)) {
    const timer = setTimeout(() => void sync(), 450); return () => clearTimeout(timer);
  } }, [state.pending, state.room, sync]);
  const setProfile = useCallback((profile: Profile) => {
    commit(current => ({ ...current, profile }));
    if (ref.current.room) rememberRoomAddress(ref.current.room, profile);
  }, [commit]);
  const setName = useCallback((value: string) => {
    const name = value.trim().slice(0, 30) || 'Julius';
    commit(current => ({ ...current, name, pending: current.room ? [...current.pending,
      { id: crypto.randomUUID(), room: current.room, action: 'rename', name }] : current.pending }));
  }, [commit]);
  const toggleFavorite = useCallback((id: string) => {
    commit(current => { const profile = current.profile, selected = !current.favorites[profile].includes(id);
      return { ...current, favorites: { ...current.favorites, [profile]: selected ? [...current.favorites[profile], id]
        : current.favorites[profile].filter(value => value !== id) }, pending: current.room ? [...current.pending,
        { id: crypto.randomUUID(), room: current.room, action: 'favorite', profile, sessionId: id, selected }] : current.pending }; });
    if (ref.current.room) setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  }, [commit]);
  const createRoom = useCallback(async (): Promise<string> => {
    setSyncStatus('syncing'); setError(null);
    try { const current = ref.current;
      const data = await request(null, { action: 'create', name: current.name, favorites: current.favorites });
      if (!isRoomKey(data.room)) throw new Error('Der Einladungslink konnte nicht erstellt werden.');
      const room = data.room; commit(value => ({ ...value, ...overlay(data, [], room), room }));
      rememberRoomAddress(room); setSyncStatus('synced'); return room;
    } catch (failure) { const message = errorMessage(failure); setError(message); setSyncStatus('error'); throw new Error(message); }
  }, [commit]);
  const joinRoom = useCallback(async (room: string, profile?: Profile) => {
    setSyncStatus('syncing'); setError(null);
    try {
      if (!isRoomKey(room)) throw new Error('Der Link ist unvollständig. Bitte kopiere den gesamten Einladungslink aus dem Team-Menü.');
      const data = await request(room);
      commit(current => ({ ...current, ...overlay(data, current.pending, room), room, ...(profile ? { profile } : {}) }));
      rememberRoomAddress(room, profile || ref.current.profile); setSyncStatus('synced');
    } catch (failure) { const message = errorMessage(failure); setError(message); setSyncStatus(ref.current.room ? 'error' : 'local'); throw new Error(message); }
  }, [commit]);
  const leaveRoom = useCallback(() => {
    commit(current => ({ ...current, room: null })); rememberRoomAddress(null); setSyncStatus('local'); setError(null);
  }, [commit]);
  return { profile: state.profile, setProfile, name: state.name, setName, favorites: state.favorites, toggleFavorite,
    room: state.room, createRoom, joinRoom, leaveRoom, shareUrl: state.room ? buildInvitation(state.room) : null,
    getInviteLink: (profile: Profile) => state.room ? buildInvitation(state.room, profile) : null,
    syncStatus, error, retry: () => void sync(), clearError: () => setError(null) };
}
