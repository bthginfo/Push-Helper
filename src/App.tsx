import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, Clock3, Coffee, Copy, Heart, Link2, MapPin, Moon, Navigation, Radio, RefreshCw, Search, SlidersHorizontal, Sparkles, Sun, Users, WifiOff, X } from 'lucide-react';
import program from './data/program.json';
import type { Profile, Session } from './lib/types';
import { PROFILES, profileName as personName } from './lib/people';
import { buildInvitation, parseInvitation, type Invitation } from './lib/invitation';
import { usePlanner } from './lib/usePlanner';
import { conferenceNow, findConflicts, getLiveSessions, getNextSession, sessionState } from './lib/time';
import { downloadCalendar } from './lib/calendar';

type View = 'agenda' | 'favorites' | 'venue';
type PersonFilter = 'all' | Profile | 'both';
type Theme = 'light' | 'dark' | 'system';
const sessions = program.sessions as Session[];
const days = ['2026-10-22', '2026-10-23'] as const;
const dayLabels = ['Donnerstag', 'Freitag'];
const isBreak = (session: Session) => ['Pause', 'Organisation'].includes(session.type);
const shortDate = (day: string) => day === days[0] ? 'Do, 22. Oktober' : 'Fr, 23. Oktober';
const roomLabel = (room: string) => room || 'Ort laut Programm';

function initialTheme(): Theme {
  try { const saved = localStorage.getItem('push-theme'); if (saved === 'light' || saved === 'dark' || saved === 'system') return saved; } catch { /* Browser storage may be unavailable. */ }
  return 'system';
}

function Avatar({ person, name, small = false }: { person: Profile; name: string; small?: boolean }) {
  return <span className={`avatar avatar-${person}${small ? ' avatar-small' : ''}`} aria-hidden="true">{personName(person, name).trim()[0].toUpperCase()}</span>;
}

function Modal({ children, onClose, label, className = '' }: { children: ReactNode; onClose: () => void; label: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={label} onCancel={event => { event.preventDefault(); closeRef.current(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    const first = targets[0]; const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="sheet-handle" />
    <button className="icon-button modal-close" onClick={onClose} aria-label="Schließen"><X size={20} /></button>
    {children}
  </dialog>;
}

function SpeakerAvatar({ speaker }: { speaker: Session['speakers'][number] }) {
  const [failed, setFailed] = useState(false);
  return <span className="speaker-avatar">{speaker.image && !failed ? <img src={speaker.image} alt="" loading="lazy" onError={() => setFailed(true)} /> : speaker.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>;
}

function SessionOptions({ items, children }: { items: Session[]; children: ReactNode }) {
  if (!items.every(session => session.group === 'B')) return <>{children}</>;
  const label = items.length === 1 && items[0].type === 'Pause' ? 'Mittagspause' : `${items.length} ${items.length === 1 ? 'Option' : 'Optionen'}`;
  return <details className="group-b-options">
    <summary><span><strong>Gruppe B</strong><span>{label}</span></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="group-b-content">{children}</div>
  </details>;
}

function SessionDetails({ session, onClose, selected, onToggle, others, yourName }: { session: Session; onClose: () => void; selected: boolean; onToggle: () => void; others: string[]; yourName: string }) {
  return <Modal label={session.title} onClose={onClose} className="session-modal">
    <div className="detail-content">
      <div className="eyebrow detail-eyebrow">{shortDate(session.day)} <span>·</span> {session.type}</div>
      <h2 className="detail-title">{session.title}</h2>
      <div className="detail-meta"><span><Clock3 size={16} />{session.start}–{session.end}{session.endEstimated ? ' ca.' : ''}</span><span><MapPin size={16} />{roomLabel(session.room)}</span></div>
      {session.tldr && <section className="tldr"><p>{session.tldr}</p></section>}
      {session.bookingRequired && <div className="booking-notice"><CalendarDays size={19} /><div><strong>Separat reservieren</strong><p>Für diesen Breakout ist eine Reservierung beim Veranstalter nötig. Deine Auswahl hier ist keine Buchung.</p><a href={session.sourceUrl} target="_blank" rel="noreferrer">Zur offiziellen Session <ArrowUpRight size={13} /></a></div></div>}
      {session.speakers.length > 0 && <section className="speakers-section"><h3>{session.speakers.length > 1 ? 'Die Speaker' : 'Auf der Bühne'}</h3>{session.speakers.map(speaker => <div className="speaker" key={speaker.name}><div className="speaker-heading"><SpeakerAvatar speaker={speaker} /><div><strong>{speaker.name}</strong><p>{[speaker.role, speaker.company].filter(Boolean).join(' · ')}</p></div></div>{speaker.bio && <p className="speaker-bio">{speaker.bio}</p>}</div>)}</section>}
      {session.description.length > 0 && <section className="description"><h3>Mehr zur Session</h3>{session.description.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>}
      {session.tags.length > 0 && <div className="detail-tags">{session.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      <a className="source-link" href={session.sourceUrl} target="_blank" rel="noreferrer">Im offiziellen Programm ansehen <ArrowUpRight size={15} /></a>
    </div>
    <footer className="detail-footer">{others.length > 0 && <div className="detail-attendance">Auch vorgemerkt: {others.join(', ')}</div>}<button className={`primary-button ${selected ? 'selected-button' : ''}`} onClick={onToggle}>{selected ? <Check size={18} /> : <Heart size={18} />}{selected ? `Für ${yourName} vorgemerkt` : 'Zu meiner Auswahl'}</button></footer>
  </Modal>;
}

export default function App() {
  const planner = usePlanner();
  const [view, setView] = useState<View>('agenda');
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<string>(() => { const today = conferenceNow().day; return days.includes(today as typeof days[number]) ? today : days[0]; });
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<Invitation | null>(() => parseInvitation(location.href));
  const [inviteProfile, setInviteProfile] = useState<Profile>(() => parseInvitation(location.href)?.profile || 'daniel');
  const [inviteTarget, setInviteTarget] = useState<Profile>('tobi');
  const [joinInput, setJoinInput] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamMessage, setTeamMessage] = useState('');
  const [nameDraft, setNameDraft] = useState(planner.name === 'Ich' ? '' : planner.name);
  const nameDraftDirty = useRef(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt(): Promise<void> }) | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownFavorites = planner.favorites[planner.profile];
  const ownerName = planner.name || 'Julius';
  const profileName = personName(planner.profile, ownerName);
  const yourName = profileName;
  const hasPendingInvite = Boolean(pendingInvite && (pendingInvite.room !== planner.room || pendingInvite.profile && pendingInvite.profile !== planner.profile));
  const inviteUrl = planner.getInviteLink(inviteTarget);
  const today = conferenceNow(now);
  const live = getLiveSessions(sessions, now).filter(item => !isBreak(item));
  const next = getNextSession(sessions.filter(item => !isBreak(item)), now);
  const conferenceStarted = today.day >= days[0];
  const conferenceOver = today.day > days[1] || (today.day === days[1] && !next && live.length === 0);
  const nextFeatured = live[0] || next;
  const selectedSessions = sessions.filter(session => ownFavorites.includes(session.id));
  const types = Array.from(new Set(sessions.filter(session => !isBreak(session)).map(session => session.type)));
  const rooms = Array.from(new Set(sessions.map(session => session.room).filter(Boolean)));
  const hasFilters = Boolean(query || type !== 'all' || roomFilter !== 'all' || personFilter !== 'all');
  const filterCount = Number(type !== 'all') + Number(roomFilter !== 'all') + Number(personFilter !== 'all');
  const resetFilters = () => { setQuery(''); setType('all'); setRoomFilter('all'); setPersonFilter('all'); };
  const announce = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { const dark = theme === 'dark' || (theme === 'system' && media.matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131518' : '#f7f8fa'); };
    apply(); media.addEventListener('change', apply);
    try { localStorage.setItem('push-theme', theme); } catch { /* Theme still works without persistence. */ }
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 30000);
    const visibility = () => { if (!document.hidden) tick(); };
    const onOnline = () => setOnline(navigator.onLine);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as Event & { prompt(): Promise<void> }); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOnline);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); window.removeEventListener('beforeinstallprompt', onInstall); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    if (days.includes(today.day as typeof days[number])) setDay(today.day);
  }, [today.day]);

  useEffect(() => { if (hasPendingInvite) setTeamOpen(true); }, [hasPendingInvite]);
  useEffect(() => {
    if (!teamOpen) { nameDraftDirty.current = false; return; }
    if (!nameDraftDirty.current) setNameDraft(planner.name === 'Ich' ? '' : planner.name);
  }, [teamOpen, planner.name]);
  useEffect(() => {
    const onHash = () => { const invitation = parseInvitation(location.href); setPendingInvite(invitation); if (invitation) setInviteProfile(invitation.profile || 'daniel'); };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && !teamOpen && !activeSession) { event.preventDefault(); setView('agenda'); requestAnimationFrame(() => searchRef.current?.focus()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [teamOpen, activeSession]);

  const filtered = useMemo(() => sessions.filter(session => {
    if (session.day !== day) return false;
    if (view === 'favorites' && !ownFavorites.includes(session.id)) return false;
    if (type !== 'all' && session.type !== type) return false;
    if (roomFilter !== 'all' && session.room !== roomFilter) return false;
    if (personFilter === 'both' && !PROFILES.every(person => planner.favorites[person].includes(session.id))) return false;
    if (personFilter !== 'all' && personFilter !== 'both' && !planner.favorites[personFilter].includes(session.id)) return false;
    const normalized = query.trim().toLocaleLowerCase('de');
    return !normalized || [session.title, session.room, session.type, session.tldr, ...session.tags, ...session.speakers.map(speaker => `${speaker.name} ${speaker.company}`)].join(' ').toLocaleLowerCase('de').includes(normalized);
  }), [day, view, ownFavorites, planner.favorites, query, type, roomFilter, personFilter]);
  const groups = useMemo(() => {
    const result = new Map<string, Session[]>();
    for (const session of filtered) { const existing = result.get(session.start) || []; existing.push(session); result.set(session.start, existing); }
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);
  const todayCount = sessions.filter(session => session.day === day && !isBreak(session)).length;
  const ownDayCount = selectedSessions.filter(session => session.day === day).length;
  const overlapIds = new Set(findConflicts(selectedSessions).flat());

  const changeView = (nextView: View) => { setView(nextView); resetFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleFavorite = (id: string) => { const removing = ownFavorites.includes(id); planner.toggleFavorite(id); announce(removing ? 'Aus deiner Auswahl entfernt' : 'Zu deiner Auswahl hinzugefügt'); };
  const saveNameDraft = () => {
    if (!nameDraftDirty.current) return;
    const normalized = nameDraft.trim().slice(0, 30) || 'Julius';
    nameDraftDirty.current = false;
    if (normalized !== planner.name) planner.setName(normalized);
    setNameDraft(normalized === 'Ich' ? '' : normalized);
  };
  const handleCreate = async () => { setTeamBusy(true); setTeamMessage(''); try { saveNameDraft(); await planner.createRoom(); } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Der Einladungslink konnte nicht erstellt werden. Bitte erneut versuchen.'); } finally { setTeamBusy(false); } };
  const handleJoin = async () => { if (!pendingInvite) return; setTeamBusy(true); setTeamMessage(''); try { await planner.joinRoom(pendingInvite.room, inviteProfile); setPendingInvite(null); setJoinInput(''); announce('Plan geladen'); } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Die Einladung konnte nicht geöffnet werden. Bitte erneut versuchen.'); } finally { setTeamBusy(false); } };
  const copyLink = async () => { if (!inviteUrl) return; try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setTeamMessage('Bitte kopiere den Einladungslink direkt aus dem Linkfeld.'); } };
  const invitePerson = async (person: Profile) => {
    setTeamBusy(true); setTeamMessage(''); setInviteTarget(person); setCopied(false);
    try {
      saveNameDraft();
      const room = planner.room || await planner.createRoom();
      const url = buildInvitation(room, person);
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
      catch { /* The selected link remains available in the read-only field. */ }
    } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Der Einladungslink konnte nicht erstellt werden.'); }
    finally { setTeamBusy(false); }
  };
  const openInvitation = () => {
    const invitation = parseInvitation(joinInput);
    if (!invitation) { setTeamMessage('Der Link enthält keinen Plan. Bitte den vollständigen Einladungslink einfügen.'); return; }
    planner.clearError(); setTeamMessage(''); setPendingInvite(invitation); setInviteProfile(invitation.profile || planner.profile);
  };
  const retryTeam = () => { setTeamMessage(''); if (hasPendingInvite) void handleJoin(); else if (planner.room) planner.retry(); else void handleCreate(); };
  const jumpToNow = () => { setView('agenda'); setDay(today.day); resetFilters(); setTimeout(() => { const target = document.querySelector('[data-live="true"]') || document.querySelector('[data-upcoming="true"]'); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 70); };
  const toggleTheme = () => { const current = document.documentElement.dataset.theme; setTheme(current === 'dark' ? 'light' : 'dark'); };
  const syncLabel = !online ? 'Offline · lokal gespeichert' : ({ local: 'Auf diesem Gerät gespeichert', syncing: 'Wird synchronisiert …', synced: 'Gemeinsam synchronisiert', offline: 'Offline · lokal gespeichert', error: 'Synchronisierung pausiert' }[planner.syncStatus]);
  const daysUntil = Math.max(0, Math.ceil((new Date(`${days[0]}T00:00:00+02:00`).getTime() - now.getTime()) / 86400000));
  const minutesUntil = next ? Math.ceil((new Date(`${next.day}T${next.start}:00+02:00`).getTime() - now.getTime()) / 60000) : 0;

  const navItems: { view: View; icon: typeof CalendarDays; label: string; shortLabel: string }[] = [{ view: 'agenda', icon: CalendarDays, label: 'Programm', shortLabel: 'Programm' }, { view: 'favorites', icon: Heart, label: 'Meine Auswahl', shortLabel: 'Auswahl' }, { view: 'venue', icon: MapPin, label: 'Vor Ort', shortLabel: 'Vor Ort' }];

  return <div className="app-shell">
    <a className="skip-link" href="#main">Zum Inhalt</a>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); changeView('agenda'); }} aria-label="PUSH Companion – Programm"><span className="wordmark">PUSH<span className="wordmark-point">.</span></span><span className="brand-bottom">COMPANION <span>2026</span></span></a>
      <nav className="desktop-nav" aria-label="Hauptnavigation">{navItems.map(item => <button key={item.view} className={view === item.view ? 'nav-item active' : 'nav-item'} onClick={() => changeView(item.view)} aria-current={view === item.view ? 'page' : undefined}><item.icon size={19} strokeWidth={1.8} /><span>{item.label}</span>{item.view === 'favorites' && ownFavorites.length > 0 && <span className="nav-count">{ownFavorites.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="sidebar-profile" onClick={() => setTeamOpen(true)}><Avatar person={planner.profile} name={ownerName} /><span><strong>{profileName}</strong><small>{planner.room ? 'Euer privater Plan' : 'Dein persönlicher Plan'}</small></span><ChevronRight size={16} /></button><span className={`sync-state ${planner.syncStatus === 'error' ? 'sync-error' : ''}`}><span className="status-dot" />{syncLabel}</span></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><span className="topbar-context">PUSH UX 2026 <span>/</span> München</span><a className="mobile-brand" href="#" onClick={event => { event.preventDefault(); changeView('agenda'); }}>PUSH<span>.</span><small>COMPANION</small></a><div className="top-actions"><button className="icon-button theme-toggle" onClick={toggleTheme} aria-label="Zwischen hellem und dunklem Modus wechseln"><Sun className="sun-icon" size={19} /><Moon className="moon-icon" size={19} /></button><button className="team-top-button" onClick={() => setTeamOpen(true)} aria-label="Team und Einladung öffnen"><span className="avatar-stack">{PROFILES.map(person => <Avatar key={person} person={person} name={ownerName} small />)}</span><span>Euer Plan</span><ChevronDown size={13} /></button></div></header>
      {!online && <div className="offline-banner" role="status"><WifiOff size={15} /> Offline. Das Programm und deine Auswahl sind weiter da.</div>}
      {planner.syncStatus === 'error' && <div className="sync-banner" role="status"><span>Deine Auswahl ist lokal gespeichert. Teilen gerade nicht möglich.</span><button onClick={planner.retry}><RefreshCw size={13} /> Erneut versuchen</button></div>}
      <main id="main" className={`main-layout ${view === 'venue' ? 'venue-layout' : ''}`} tabIndex={-1}>
        <div className="main-column">
          <div className="page-heading"><div><h1>{view === 'agenda' ? 'Programm' : view === 'favorites' ? 'Meine Auswahl' : 'Vor Ort'}</h1></div>{view === 'favorites' && <button className="icon-button export-top" onClick={() => downloadCalendar(selectedSessions, 'meine-push-2026.ics')} disabled={!selectedSessions.length} title="Auswahl als Kalenderdatei exportieren" aria-label="Auswahl als Kalenderdatei exportieren"><ArrowDownToLine size={20} /></button>}</div>

          {view !== 'venue' && <>
            <section className={`now-banner ${live.length ? 'is-live' : ''}`} aria-label="Konferenzstatus"><span className="now-symbol">{live.length ? <Radio size={22} /> : conferenceOver ? <CheckCheck size={23} /> : <Sparkles size={22} />}</span><div><strong>{live.length ? live[0].title : conferenceOver ? 'Konferenz beendet' : conferenceStarted && next ? `In ${minutesUntil < 60 ? `${minutesUntil} Min.` : `${Math.floor(minutesUntil / 60)} Std.`}: ${next.title}` : `Noch ${daysUntil} ${daysUntil === 1 ? 'Tag' : 'Tage'} bis zur PUSH.`}</strong><span className="now-caption">{live.length ? `${live[0].start}–${live[0].end} · ${live[0].room}${live.length > 1 ? ` · +${live.length - 1} parallel` : ''}` : conferenceOver ? '' : next ? `Start ${shortDate(next.day)} · ${next.start} Uhr` : '22. & 23. Oktober 2026'}</span></div>{live.length ? <button className="now-action" onClick={jumpToNow} aria-label="Zu den aktuellen Sessions"><ArrowRight size={19} /></button> : null}</section>

            <div className="agenda-controls"><div className="day-switch" role="tablist" aria-label="Konferenztag">{days.map((item, index) => <button key={item} id={`tab-${item}`} role="tab" aria-controls="agenda-panel" aria-selected={day === item} className={day === item ? 'day-tab active' : 'day-tab'} onClick={() => setDay(item)}><span className="day-number">{index === 0 ? '22' : '23'}<span>OKT</span></span><span className="day-tab-text"><strong>{dayLabels[index]}</strong><small>{index === 0 ? 'Tag eins' : 'Tag zwei'}{today.day === item ? ' · Heute' : ''}</small></span>{day === item && <span className="day-check"><Check size={13} /></span>}</button>)}</div>
              <div className="search-row"><label className="search-field"><Search size={18} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Thema, Session, Speaker …" aria-label="Programm durchsuchen" type="search" />{query ? <button className="search-clear" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Suche löschen"><X size={15} /></button> : <kbd>⌘ K</kbd>}</label><button className={`filter-button ${filtersOpen || filterCount ? 'is-active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="filters" aria-label={`Filter${filterCount ? `, ${filterCount} aktiv` : ''}`}><SlidersHorizontal size={18} />{filterCount > 0 && <span>{filterCount}</span>}</button></div>
              {filtersOpen && <div id="filters" className="filters-panel"><div className="select-filter"><label htmlFor="type-filter">Format</label><select id="type-filter" value={type} onChange={event => setType(event.target.value)}><option value="all">Alle Formate</option>{types.map(item => <option key={item}>{item}</option>)}</select></div><div className="select-filter"><label htmlFor="room-filter">Ort</label><select id="room-filter" value={roomFilter} onChange={event => setRoomFilter(event.target.value)}><option value="all">Alle Orte</option>{rooms.map(item => <option key={item}>{item}</option>)}</select></div><div className="people-filter"><span>Wer möchte hin?</span><div role="group" aria-label="Nach Person filtern">{([{ id: 'all', label: 'Alle' }, { id: 'you', label: ownerName }, { id: 'daniel', label: 'Daniel' }, { id: 'tobi', label: 'Tobi' }, { id: 'both', label: 'Alle drei' }] as { id: PersonFilter; label: string }[]).map(item => <button key={item.id} aria-pressed={personFilter === item.id} className={personFilter === item.id ? 'active' : ''} onClick={() => setPersonFilter(item.id)}>{item.label}</button>)}</div></div></div>}
            </div>

            <div className="agenda-summary"><span>{hasFilters ? `${filtered.length} Treffer` : view === 'favorites' ? `${ownDayCount} ${ownDayCount === 1 ? 'Session' : 'Sessions'} vorgemerkt` : `${todayCount} Sessions`}</span>{hasFilters ? <button onClick={resetFilters}>Zurücksetzen <X size={12} /></button> : <span className="attendance-legend">{PROFILES.map(person => <span className="legend-person" key={person}><i className={`person-dot ${person}-dot`} />{personName(person, ownerName)}</span>)}</span>}</div>
            {view === 'favorites' && overlapIds.size > 0 && filtered.some(session => overlapIds.has(session.id)) && <div className="overlap-notice"><Clock3 size={15} />Einige deiner Sessions überschneiden sich. Du kannst dich später entscheiden.</div>}
            <div ref={agendaRef} id="agenda-panel" role="tabpanel" aria-labelledby={`tab-${day}`} className="agenda-list">
              {groups.length ? groups.map(([start, items], groupIndex) => {
                const groupLive = items.some(item => sessionState(item, now) === 'live');
                const groupUpcoming = !groupLive && items.some(item => sessionState(item, now) === 'upcoming');
                const groupBreak = items.every(isBreak);
                return <section className={`time-group ${groupLive ? 'time-group-live' : ''} ${groupBreak ? 'time-group-break' : ''}`} key={`${day}-${start}`} data-live={groupLive} data-upcoming={groupUpcoming} style={{ animationDelay: `${Math.min(groupIndex, 7) * 35}ms` }}>
                  <div className="time-label"><span>{start}</span><i className="rail-dot" />{groupLive && <small>JETZT</small>}</div>
                  <div className="time-sessions"><SessionOptions items={items}>{items.length > 1 && <span className="parallel-label">{items.length} Sessions zur gleichen Zeit </span>}{items.map(session => {
                    const selected = ownFavorites.includes(session.id); const attendees = PROFILES.filter(person => planner.favorites[person].includes(session.id)); const state = sessionState(session, now);
                    return <article className={`session-row ${isBreak(session) ? 'break-row' : ''} ${isBreak(session) && /lunch|mittag/i.test(session.title) ? 'lunch-row' : ''} ${state === 'ended' ? 'session-ended' : ''} ${state === 'live' ? 'session-live' : ''}`} key={session.id}>
                      <button className="session-open" onClick={() => setActiveSession(session)} aria-label={`Details: ${session.title}`}>
                        {isBreak(session) ? <><span className="break-icon"><Coffee size={18} /></span><span className="break-info"><strong>{session.title}</strong><small>{session.start}–{session.end}{session.endEstimated ? ' ca.' : ''}{session.room ? ` · ${session.room}` : ''}</small></span><ChevronRight size={16} className="session-chevron" /></> : <><div className="session-topline"><span className={`session-type type-${session.type.toLowerCase().replaceAll(' ', '-')}`}>{session.type}</span>{session.group && <span className="group-label">Gruppe {session.group}</span>}{state === 'live' && <span className="live-pill"><i /> Live</span>}<span className="session-duration">{session.start}–{session.end}{session.endEstimated ? ' ca.' : ''}</span></div><h2>{session.title}</h2>{session.speakers.length > 0 && <p className="session-speakers">{session.speakers.map(speaker => speaker.name).join(' & ')}{session.speakers.length === 1 && session.speakers[0].company && <span> · {session.speakers[0].company}</span>}</p>}<div className="session-bottomline"><span><MapPin size={12} />{roomLabel(session.room)}</span>{session.bookingRequired && <span className="reservation-label">Reservierung nötig</span>}{attendees.length > 0 && <span className="attendance-dots">{attendees.map(person => <span key={person} className={`person-dot ${person}-dot`} title={`${personName(person, ownerName)} möchte hin`} />)}</span>}</div></>}
                      </button>
                      {!isBreak(session) && <button className={`favorite-button ${selected ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(session.id)} aria-pressed={selected} aria-label={`${session.title}: ${selected ? 'aus meiner Auswahl entfernen' : 'zu meiner Auswahl hinzufügen'}`}><Heart size={19} strokeWidth={1.7} fill={selected ? 'currentColor' : 'none'} /></button>}
                    </article>;
                  })}</SessionOptions></div>
                </section>;
              }) : <div className="empty-state"><span className="empty-icon">{hasFilters ? <Search size={28} /> : <Heart size={28} />}</span><h2>{hasFilters ? 'Keine Treffer' : 'Keine Auswahl'}</h2><p>{hasFilters ? 'Versuch einen anderen Suchbegriff oder lockere deine Filter.' : `Am ${shortDate(day)} hast du noch nichts vorgemerkt. Ein Herz im Programm genügt.`}</p><button className="secondary-button" onClick={hasFilters ? resetFilters : () => changeView('agenda')}>{hasFilters ? 'Alle Filter zurücksetzen' : 'Programm entdecken'}<ArrowRight size={15} /></button></div>}
            </div>
            <div className="program-footnote"><p>Zeiten in München · Änderungen durch den Veranstalter möglich.<br />{sessions.some(item => item.endEstimated) && '„ca.“ kennzeichnet aus dem Ablauf abgeleitete Endzeiten.'}</p><a href={program.sourceUrl} target="_blank" rel="noreferrer">Offizielles Programm <ArrowUpRight size={12} /></a></div>
          </>}

          {view === 'venue' && <div className="venue-content"><section className="venue-hero"><div className="venue-art" aria-hidden="true"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-road road-four" /><span className="map-block block-one" /><span className="map-block block-two" /><span className="map-block block-three" /><span className="map-pin-art"><MapPin size={32} fill="currentColor" /><i /></span><span className="map-caption">MÜNCHEN</span></div><div className="venue-hero-body"><h2>{program.venue.name}</h2><p>{program.venue.address}<br />{program.venue.city}</p><a className="primary-button" href={program.venue.mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} />Route öffnen<ArrowUpRight size={15} /></a></div></section><section className="venue-section"><span className="venue-section-icon"><Navigation size={20} /></span><div><h2>Anreise</h2>{program.venue.transit.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section><section className="venue-section"><span className="venue-section-icon"><MapPin size={21} /></span><div><h2>Orientierung vor Ort</h2><p>{program.venue.floorplanUrl ? 'Der offizielle Lageplan hilft dir, dich vor Ort zu orientieren.' : 'Ein offizieller Lageplan ist derzeit nicht veröffentlicht. Die Raumangaben findest du bei jeder Session. Das Team vor Ort hilft dir beim Ankommen.'}</p>{program.venue.floorplanUrl && <a className="text-link" href={program.venue.floorplanUrl} target="_blank" rel="noreferrer">Offiziellen Lageplan öffnen <ArrowUpRight size={14} /></a>}</div></section><section className="venue-section"><span className="venue-section-icon"><Heart size={20} /></span><div><h2>Vormerken ist keine Reservierung</h2><p>Ihr stellt hier euren persönlichen Plan zusammen. Einige Breakouts benötigen zusätzlich eine Buchung über die offizielle Konferenzseite. Diese Sessions sind im Programm gekennzeichnet.</p></div></section><div className="venue-source"><a className="source-link" href={program.venue.sourceUrl} target="_blank" rel="noreferrer">Alle Infos beim Veranstalter <ArrowUpRight size={14} /></a></div></div>}
        </div>

        <aside className="context-column" aria-label="Dein Überblick"><section className="team-card"><div className="team-portraits">{PROFILES.map(person => <Avatar key={person} person={person} name={ownerName} />)}</div><div className="team-stats">{PROFILES.map(person => <div key={person}><strong>{planner.favorites[person].length}</strong><span>{personName(person, ownerName)}</span></div>)}</div><button className="secondary-button full-width" onClick={() => setTeamOpen(true)}>Team & Einladungen <ChevronRight size={15} /></button></section>
          {nextFeatured && <section className="next-card"><div className="context-heading"><span>{live.length ? 'JETZT' : 'ALS NÄCHSTES'}</span>{live.length ? <Radio size={15} /> : <ArrowUpRight size={16} />}</div><span className="next-date">{shortDate(nextFeatured.day)} <span>·</span> {nextFeatured.start}</span><button className="next-session" onClick={() => setActiveSession(nextFeatured)}><span className="session-type">{nextFeatured.type}</span><h3>{nextFeatured.title}</h3><p>{nextFeatured.speakers.map(speaker => speaker.name).join(' & ')}</p><span className="next-link">Details <ArrowRight size={15} /></span></button></section>}
          {selectedSessions.length > 0 && <button className="calendar-export" onClick={() => { downloadCalendar(selectedSessions, 'meine-push-2026.ics'); announce('Kalenderdatei wird heruntergeladen'); }}><span className="export-symbol"><ArrowDownToLine size={19} /></span><span><strong>Dein Plan im Kalender</strong><small>{selectedSessions.length} Sessions als .ics exportieren</small></span><ChevronRight size={14} /></button>}
          {installPrompt && <button className="calendar-export" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}><span className="export-symbol"><ArrowDownToLine size={19} /></span><span><strong>App installieren</strong><small>Auf deinem Gerät installieren</small></span><ChevronRight size={14} /></button>}
        </aside>
      </main>
      <footer className="app-footer"><a href="https://push-conference.com/de" target="_blank" rel="noreferrer">PUSH UX 2026 <ArrowUpRight size={11} /></a></footer>
    </div>

    <nav className="bottom-nav" aria-label="Mobile Hauptnavigation">{navItems.map(item => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => changeView(item.view)} aria-current={view === item.view ? 'page' : undefined}><span className="bottom-icon"><item.icon size={22} strokeWidth={view === item.view ? 2 : 1.7} />{item.view === 'favorites' && ownFavorites.length > 0 && <i>{ownFavorites.length}</i>}</span><span>{item.shortLabel}</span></button>)}<button onClick={() => setTeamOpen(true)} aria-label="Team und Einladung"><span className="bottom-icon"><Users size={22} strokeWidth={1.7} />{planner.room && <i className="connected-dot" />}</span><span>Team</span></button></nav>
    <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status" aria-live="polite"><Check size={15} />{toast}</div>

    {activeSession && <SessionDetails session={activeSession} onClose={() => setActiveSession(null)} selected={ownFavorites.includes(activeSession.id)} onToggle={() => toggleFavorite(activeSession.id)} others={PROFILES.filter(person => person !== planner.profile && planner.favorites[person].includes(activeSession.id)).map(person => personName(person, ownerName))} yourName={yourName} />}
    {teamOpen && <Modal label={hasPendingInvite ? 'Einladung zur gemeinsamen Planung' : 'Team'} onClose={() => { if (planner.profile === 'you' && !hasPendingInvite) saveNameDraft(); setTeamOpen(false); }} className="team-modal"><div className="team-modal-inner">
      <h2>{hasPendingInvite ? 'Plan beitreten' : 'Team'}</h2>
      {hasPendingInvite ? <>
        <div className="profile-choices">{PROFILES.map(person => <button key={person} className={inviteProfile === person ? 'profile-choice active' : 'profile-choice'} onClick={() => setInviteProfile(person)} aria-pressed={inviteProfile === person}><Avatar person={person} name={ownerName} /><strong>{personName(person, ownerName)}</strong>{inviteProfile === person && <Check size={16} />}</button>)}</div>
        <button className="primary-button full-width" disabled={teamBusy} onClick={handleJoin}>{teamBusy ? <RefreshCw className="spin" size={17} /> : <Link2 size={17} />}{teamBusy ? 'Wird verbunden …' : 'Als ' + personName(inviteProfile, ownerName) + ' beitreten'}</button>
      </> : <>
        <div className="profile-choices" aria-label="Aktives Profil">{PROFILES.map(person => <button key={person} className={planner.profile === person ? 'profile-choice active' : 'profile-choice'} onClick={() => { if (planner.profile === 'you') saveNameDraft(); setPendingInvite(null); planner.setProfile(person); }} aria-pressed={planner.profile === person}><Avatar person={person} name={ownerName} /><strong>{personName(person, ownerName)}</strong>{planner.profile === person && <Check size={16} />}</button>)}</div>
        {planner.profile === 'you' && <label className="name-field">Dein Name<input maxLength={30} value={nameDraft} placeholder="Julius" onChange={event => { nameDraftDirty.current = true; setNameDraft(event.target.value); }} onBlur={saveNameDraft} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} autoComplete="given-name" /></label>}
        <div className="team-modal-divider" />
        <div className="invite-buttons">{(['daniel', 'tobi'] as const).map(person => <button key={person} className="secondary-button" disabled={teamBusy} onClick={() => void invitePerson(person)}><Link2 size={16} />{personName(person)} einladen</button>)}</div>
        {inviteUrl && <label className="share-link-field"><span>Link für {personName(inviteTarget, ownerName)}{copied ? ' · kopiert' : ''}</span><div><input aria-label="Privater Einladungslink" readOnly value={inviteUrl} onFocus={event => event.target.select()} /><button className="icon-button" onClick={copyLink} aria-label="Einladungslink kopieren">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div></label>}
        {!planner.room && <button className="text-link create-plan" disabled={teamBusy} onClick={handleCreate}>Gemeinsamen Plan erstellen</button>}
        <details className="join-plan"><summary>Einladungslink öffnen</summary><label><span className="sr-only">Einladungslink</span><input value={joinInput} onChange={event => setJoinInput(event.target.value)} placeholder="Vollständigen Link einfügen" autoCapitalize="none" autoCorrect="off" spellCheck={false} type="text" /></label><button className="secondary-button" disabled={!joinInput.trim() || teamBusy} onClick={openInvitation}>Öffnen</button></details>
        {planner.room && <button className="leave-button" onClick={() => { planner.leaveRoom(); setPendingInvite(null); setTeamMessage(''); announce('Plan auf diesem Gerät verlassen'); }}>Plan auf diesem Gerät verlassen</button>}
      </>}
      {(inviteUrl || hasPendingInvite) && <p className="capability-note">Wer den Link hat, kann den Plan sehen und bearbeiten.</p>}
      {(teamMessage || planner.error) && <div className="team-error" role="alert"><p>{teamMessage || planner.error}</p><button disabled={teamBusy} onClick={retryTeam}><RefreshCw size={13} />Erneut versuchen</button></div>}
      <div className={'team-sync-info ' + (planner.syncStatus === 'error' ? 'sync-error' : '')}><span className={'status-dot ' + (!online ? 'offline-dot' : '')} />{syncLabel}</div>
      <details className="appearance-settings"><summary>Darstellung <span>{theme === 'system' ? 'Automatisch' : theme === 'dark' ? 'Dunkel' : 'Hell'}<ChevronDown size={14} /></span></summary><div role="group" aria-label="Darstellung">{([{ value: 'light', label: 'Hell', icon: Sun }, { value: 'dark', label: 'Dunkel', icon: Moon }, { value: 'system', label: 'System', icon: Sparkles }] as const).map(item => <button key={item.value} className={theme === item.value ? 'active' : ''} aria-pressed={theme === item.value} onClick={() => setTheme(item.value)}><item.icon size={15} />{item.label}</button>)}</div></details>
    </div></Modal>}
  </div>;
}
