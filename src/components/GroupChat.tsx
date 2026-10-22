import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, Link2, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { MAX_MESSAGE_LENGTH, MAX_MESSAGES } from '../lib/chat';
import { PROFILES, profileName } from '../lib/people';
import type { ChatMessage, Profile } from '../lib/types';

interface Props {
  room: string | null; messages: ChatMessage[]; pendingIds: string[]; profile: Profile; ownerName: string;
  status: string; error: string | null; busy: boolean; online: boolean;
  onProfile: (profile: Profile) => void; onSend: (text: string) => boolean;
  onRetry: () => void; onCreate: () => void; onTeam: () => void;
}
const messageTime = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const messageDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'long' });
const messageDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
const dateKey = (date: string) => messageDay.format(new Date(date));

export default function GroupChat({ room, messages, pendingIds, profile, ownerName, status, error, busy, online, onProfile, onSend, onRetry, onCreate, onTeam }: Props) {
  const [draft, setDraft] = useState(() => { try { return room ? localStorage.getItem('push-chat-draft-' + room) || '' : ''; } catch { return ''; } });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const previousRoom = useRef(room);
  const [newBelow, setNewBelow] = useState(false);
  const lastMessage = messages.at(-1);
  const pending = new Set(pendingIds);
  useEffect(() => {
    if (previousRoom.current !== room) {
      previousRoom.current = room; stickToBottom.current = true;
      try { setDraft(room ? localStorage.getItem('push-chat-draft-' + room) || '' : ''); } catch { setDraft(''); }
    }
  }, [room]);
  const scrollToBottom = () => { const list = listRef.current; if (list) list.scrollTop = list.scrollHeight; stickToBottom.current = true; setNewBelow(false); };
  useEffect(() => {
    const list = listRef.current;
    if (stickToBottom.current && list) list.scrollTop = list.scrollHeight;
    else if (lastMessage) setNewBelow(true);
  }, [lastMessage?.id, room]);
  const updateDraft = (value: string) => {
    setDraft(value);
    try { if (room) { if (value) localStorage.setItem('push-chat-draft-' + room, value); else localStorage.removeItem('push-chat-draft-' + room); } } catch { /* Sending still works when draft persistence is unavailable. */ }
  };
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (onSend(draft)) { updateDraft(''); stickToBottom.current = true; setNewBelow(false); inputRef.current?.focus(); }
  };
  if (!room) return <section className="chat-start"><span className="empty-icon"><MessageCircle size={28} /></span><h2>Euer Chat zur PUSH</h2><p>Der Gruppenchat gehört zu eurem gemeinsamen Plan. Öffne euren Einladungslink oder erstelle einen Plan für Julius, Daniel, Tobi und Rafi.</p><button className="primary-button" disabled={busy} onClick={onCreate}>{busy ? <RefreshCw className="spin" size={17} /> : <MessageCircle size={17} />}{busy ? 'Wird erstellt …' : 'Gemeinsamen Plan erstellen'}</button><button className="secondary-button" onClick={onTeam}><Link2 size={16} />Einladungslink öffnen</button>{error && <p className="chat-error" role="alert">{error}</p>}</section>;

  return <section className="group-chat" aria-label="Gruppenchat">
    <div className="chat-members"><div className="chat-member-label"><span>Senden als <strong>{profileName(profile, ownerName)}</strong></span><button className="text-link" onClick={onTeam}><Link2 size={14} />Einladen</button></div><div className="map-profiles" role="group" aria-label="Chat-Profil">{PROFILES.map(person => <button key={person} onClick={() => onProfile(person)} aria-pressed={profile === person} className={profile === person ? 'active' : ''}><i className={`person-dot ${person}-dot`} />{profileName(person, ownerName)}</button>)}</div></div>
    <div className="chat-connection" role="status"><i className={`status-dot ${!online || status === 'error' ? 'offline-dot' : ''}`} /><span>{!online ? 'Offline · Nachrichten warten auf Verbindung' : status === 'error' ? 'Verbindung unterbrochen' : status === 'syncing' ? 'Wird aktualisiert …' : 'Aktualisierung alle 10 Sekunden'}</span><button onClick={onRetry} disabled={!online || status === 'syncing'} aria-label="Chat aktualisieren"><RefreshCw size={15} /></button></div>
    {error && <div className="chat-error" role="alert"><p>{error}</p><button className="text-link" onClick={onRetry} disabled={!online}>Erneut versuchen</button></div>}
    <div className="chat-panel">
      <div ref={listRef} className="chat-messages" role="log" aria-label="Nachrichten" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => { const list = listRef.current; if (list) { stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60; if (stickToBottom.current) setNewBelow(false); } }}>
        {!messages.length && <div className="chat-empty"><MessageCircle size={27} /><h2>Noch keine Nachrichten</h2><p>Treffpunkt ausmachen, eine Session empfehlen oder kurz Bescheid geben.</p></div>}
        {messages.map((message, index) => {
          const own = message.profile === profile;
          const queued = pending.has(message.id);
          const newDay = index === 0 || dateKey(messages[index - 1].createdAt) !== dateKey(message.createdAt);
          return <div key={message.id} className="chat-message-group">{newDay && <p className="chat-date">{messageDate.format(new Date(message.createdAt))}</p>}<article className={`chat-message ${own ? 'chat-own' : ''}`} aria-label={`Nachricht von ${profileName(message.profile, ownerName)}${queued ? ', noch nicht zugestellt' : ''}`}><span className={`avatar avatar-${message.profile}`} aria-hidden="true">{profileName(message.profile, ownerName)[0]}</span><div className="chat-bubble"><strong className={`chat-author chat-author-${message.profile}`}>{profileName(message.profile, ownerName)}</strong><p>{message.text}</p><div className="chat-message-meta"><time dateTime={message.createdAt}>{messageTime.format(new Date(message.createdAt))}</time>{queued && <span>{!online ? 'Wartet auf Verbindung' : status === 'error' ? 'Noch nicht zugestellt' : 'Wird gesendet …'}</span>}</div></div></article></div>;
        })}
      </div>
      {newBelow && <button className="chat-new" onClick={scrollToBottom}>Neue Nachrichten <ArrowDown size={14} /></button>}
      <form className="chat-composer" onSubmit={send} aria-label="Nachricht verfassen"><label className="sr-only" htmlFor="chat-message">Nachricht als {profileName(profile, ownerName)}</label><textarea id="chat-message" ref={inputRef} value={draft} maxLength={MAX_MESSAGE_LENGTH} rows={2} placeholder={`Nachricht als ${profileName(profile, ownerName)} …`} onChange={event => updateDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><div className="chat-compose-bottom"><span>{draft.length > 800 ? `${draft.length}/${MAX_MESSAGE_LENGTH}` : 'Enter sendet · Shift + Enter für Zeilenumbruch'}</span><button className="primary-button" type="submit" disabled={!draft.trim() || draft.length > MAX_MESSAGE_LENGTH}><Send size={16} />Senden</button></div></form>
    </div>
    <p className="chat-note">Die letzten {MAX_MESSAGES} Nachrichten bleiben im gemeinsamen Plan gespeichert. Wer euren Einladungslink hat, kann mitlesen und mit einem der Profile schreiben. Zeiten in München.</p>
  </section>;
}
