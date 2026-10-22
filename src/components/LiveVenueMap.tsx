import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Clock3, MapPin, Minus, Plus, Radio, RotateCcw } from 'lucide-react';
import type { Profile, Session } from '../lib/types';
import { PROFILES, profileName } from '../lib/people';
import { conferenceNow } from '../lib/time';
import { minutesToSession, nextPersonalStop, personalStop, placeById, places, sessionPlace, type Floor, type PlaceId } from '../lib/venue';
import VenueFloorplan from './VenueFloorplan';

interface Props {
  sessions: Session[]; favorites: Record<Profile, string[]>; profile: Profile; ownerName: string; now: Date;
  onProfile: (profile: Profile) => void; onSession: (session: Session) => void;
}
const dateLabel = (day: string) => day === '2026-10-22' ? 'Do, 22.10.' : 'Fr, 23.10.';

export default function LiveVenueMap({ sessions, favorites, profile, ownerName, now, onProfile, onSession }: Props) {
  const [preview, setPreview] = useState<{ day: string; time: string } | null>(null);
  const effectiveNow = preview ? new Date(`${preview.day}T${preview.time}:00+02:00`) : now;
  const clock = conferenceNow(effectiveNow);
  const stop = personalStop(sessions, favorites[profile], effectiveNow);
  const upcoming = stop.phase === 'live' ? nextPersonalStop(sessions, favorites[profile], effectiveNow) : null;
  const targets = [...new Set(stop.sessions.flatMap(session => { const target = sessionPlace(session); return target ? [target.place.id] : []; }))];
  const context = `${profile}:${preview ? 'preview' : 'live'}:${stop.phase}:${stop.sessions.map(session => session.id).join(',')}`;
  const [inspection, setInspection] = useState<{ context: string; id: PlaceId } | null>(null);
  const [floorChoice, setFloorChoice] = useState<{ context: string; floor: Floor } | null>(null);
  const [zoom, setZoom] = useState(1);
  const inspected = inspection?.context === context ? inspection.id : null;
  const primary = targets.length === 1 ? targets[0] : null;
  const focus = inspected || primary;
  const activeFloor = floorChoice?.context === context ? floorChoice.floor : focus ? placeById(focus).floor : 'ground';
  const place = focus ? placeById(focus) : null;
  const inspect = (id: PlaceId) => { setInspection({ context, id }); setFloorChoice({ context, floor: placeById(id).floor }); };
  const first = stop.sessions[0];
  const startsIn = first ? minutesToSession(first, effectiveNow) : 0;
  const startPreview = () => {
    const current = conferenceNow(now);
    setPreview({ day: ['2026-10-22', '2026-10-23'].includes(current.day) ? current.day : '2026-10-22', time: ['2026-10-22', '2026-10-23'].includes(current.day) ? current.time : '10:00' });
  };

  return <section className="live-map" aria-labelledby="live-map-title">
    <div className="live-map-heading"><h2 id="live-map-title">Live-Karte</h2><span className={`map-clock ${preview ? 'map-preview-label' : ''}`}>{preview ? <Clock3 size={14} /> : <Radio size={14} />}{preview ? 'Vorschau' : 'Live'} · {clock.time} Uhr</span></div>
    <div className="map-profiles" role="group" aria-label="Person für die Live-Karte">{PROFILES.map(person => <button key={person} aria-pressed={profile === person} className={profile === person ? 'active' : ''} onClick={() => onProfile(person)}><i className={`person-dot ${person}-dot`} />{profileName(person, ownerName)}</button>)}</div>
    <div className="map-time-controls">
      {preview ? <><label>Tag<select aria-label="Tag der Kartenvorschau" value={preview.day} onChange={event => setPreview({ ...preview, day: event.target.value })}><option value="2026-10-22">Do, 22. Oktober</option><option value="2026-10-23">Fr, 23. Oktober</option></select></label><label>Uhrzeit in München<input type="time" aria-label="Uhrzeit der Kartenvorschau" value={preview.time} required onChange={event => { if (/^\d{2}:\d{2}$/.test(event.target.value)) setPreview({ ...preview, time: event.target.value }); }} /></label><button className="text-link" onClick={() => setPreview(null)}><RotateCcw size={14} />Zurück zu Live</button></> : <button className="text-link" onClick={startPreview}><Clock3 size={14} />Andere Uhrzeit ansehen</button>}
    </div>

    <div className="map-destination" aria-live="polite" aria-atomic="true">
      <span className="map-status-label">{stop.phase === 'ended' ? 'Programm beendet' : stop.conflict ? 'Deine Auswahl überschneidet sich' : stop.needsChoice ? 'Wähle deine Session' : stop.phase === 'live' ? 'Jetzt für ' + profileName(profile, ownerName) : 'Als Nächstes für ' + profileName(profile, ownerName)}</span>
      {first ? <>
        {!stop.needsChoice && <h3>{sessionPlace(first)?.approximate ? 'Foyer · zur Orientierung' : sessionPlace(first)?.place.name || first.room || 'Ort noch offen'}</h3>}
        {stop.needsChoice && <p className="map-choice-note">{stop.conflict ? 'Mehrere vorgemerkte Sessions laufen gleichzeitig. Entscheide dich für einen Ort.' : 'Hier laufen mehrere Optionen parallel. Merke deine Session vor, damit die Karte dein Ziel kennt.'}</p>}
        <div className="map-session-list">{stop.sessions.map(session => {
          const destination = sessionPlace(session);
          return <div className="map-session" key={session.id}>
            <button className="map-session-location" onClick={() => destination ? inspect(destination.place.id) : onSession(session)}>
              {stop.needsChoice && <span className="map-option-place">{destination?.place.name || session.room || 'Ort offen'}</span>}
              <strong>{session.title}</strong><span>{dateLabel(session.day)} · {session.start}–{session.end}{session.endEstimated ? ' ca.' : ''}{session.group ? ` · Gruppe ${session.group}` : ''}</span>
            </button><button className="map-session-details" onClick={() => onSession(session)} aria-label={`Details und Auswahl: ${session.title}`}><ArrowRight size={18} /></button>
          </div>;
        })}</div>
        {stop.phase === 'upcoming' && <p className="map-timing">{startsIn < 60 ? `In ${startsIn} Min.` : startsIn < 24 * 60 ? `In ${Math.floor(startsIn / 60)} Std. ${startsIn % 60} Min.` : `Am ${dateLabel(first.day)} um ${first.start} Uhr`}</p>}
        {first && !stop.needsChoice && sessionPlace(first)?.approximate && <p className="map-choice-note">Das Programm nennt keinen festen Raum. Foyer und Lounge stehen als Aufenthaltsbereiche zur Verfügung.</p>}
        {!stop.personal && !stop.needsChoice && first.group === 'A' && <p className="map-choice-note">Ablauf für Gruppe A. Deine vorgemerkten Sessions haben Vorrang.</p>}
      </> : <p>Für diese Uhrzeit stehen keine weiteren Programmpunkte an. Du kannst alle Räume auf der Karte erkunden.</p>}
    </div>

    <div className="map-floor-controls" role="group" aria-label="Etage">{([{ id: 'ground', label: 'Erdgeschoss' }, { id: 'upstairs', label: 'Obergeschoss' }] as const).map(item => <button key={item.id} className={activeFloor === item.id ? 'active' : ''} aria-pressed={activeFloor === item.id} onClick={() => { setFloorChoice({ context, floor: item.id }); setZoom(1); }}>{item.label}{targets.some(id => placeById(id).floor === item.id) && <i aria-label="Ziel auf dieser Etage" />}</button>)}</div>
    <div className="map-canvas-wrap">
      <div className="map-zoom-controls" role="group" aria-label="Kartenzoom"><button onClick={() => setZoom(Math.min(2, zoom + 0.5))} disabled={zoom >= 2} aria-label="Karte vergrößern"><Plus size={18} /></button><button onClick={() => setZoom(Math.max(1, zoom - 0.5))} disabled={zoom <= 1} aria-label="Karte verkleinern"><Minus size={18} /></button></div>
      <div className="map-canvas-scroll" tabIndex={0} role="region" aria-label="Lageplan, bei Vergrößerung scrollbar"><div className="map-canvas" style={{ width: `${zoom * 100}%` }}><VenueFloorplan floor={activeFloor} targets={targets} inspected={inspected} onInspect={inspect} /></div></div>
      <div className="map-key"><span><i />{stop.needsChoice ? 'Mögliche Ziele' : stop.phase === 'upcoming' ? 'Dein nächstes Ziel' : 'Ziel laut Plan'}</span><span>Schematisch · nach deinem Lageplan</span></div>
    </div>
    <div className="map-room-buttons" role="group" aria-label="Raum auf der Karte anzeigen">{places.filter(item => item.floor === activeFloor).map(item => <button key={item.id} className={`${targets.includes(item.id) ? 'is-target' : ''} ${focus === item.id ? 'active' : ''}`} aria-pressed={focus === item.id} onClick={() => inspect(item.id)}>{item.name}</button>)}</div>
    {place && <div className="map-directions"><MapPin size={19} /><div><h3>{place.name}</h3><span>{place.floor === 'upstairs' ? 'Obergeschoss' : 'Erdgeschoss'} · {place.area}</span><p>{place.directions}</p>{(place.id === 'breakout-5' || place.id === 'breakout-6') && <p>Essen und Getränke dürfen laut Lageplan nicht mit ins Restaurant.</p>}</div></div>}
    {upcoming?.sessions[0] && <button className="map-next-stop" onClick={() => { const session = upcoming.sessions[0]; if (upcoming.needsChoice) setPreview({ day: session.day, time: session.start }); else onSession(session); }}><Clock3 size={17} /><span><small>Danach · {dateLabel(upcoming.sessions[0].day)} · {upcoming.sessions[0].start}</small><strong>{upcoming.needsChoice ? `${upcoming.sessions.length} parallele Optionen` : upcoming.sessions[0].title}</strong></span><ArrowRight size={17} /></button>}
    <div className="map-footnote"><p>Zeiten in München · aktualisiert sich alle 30 Sekunden.<br />Ziele basieren auf dem gespeicherten Programm und deiner Auswahl.</p><a className="text-link" href="/venue-map.jpg" target="_blank" rel="noreferrer">Dein Originalplan <ArrowUpRight size={13} /></a></div>
  </section>;
}
