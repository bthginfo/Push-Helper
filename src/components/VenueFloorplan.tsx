import type { KeyboardEvent, ReactNode } from 'react';
import { placeById, type Floor, type PlaceId } from '../lib/venue';

interface Props { floor: Floor; targets: PlaceId[]; inspected: PlaceId | null; onInspect: (id: PlaceId) => void }
export default function VenueFloorplan({ floor, targets, inspected, onInspect }: Props) {
  const room = (id: PlaceId, shape: ReactNode, x: number, y: number, label: string, subtitle?: string) => {
    const target = targets.includes(id);
    const activate = (event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onInspect(id); } };
    return <g key={id} role="button" tabIndex={0} aria-label={`${placeById(id).name}${target ? ' · Ziel laut Plan' : ''}`} aria-pressed={inspected === id} onClick={() => onInspect(id)} onKeyDown={activate}
      className={`floor-room ${target ? 'floor-target' : ''} ${inspected === id ? 'floor-inspected' : ''}`}>
      {shape}<text x={x} y={y} textAnchor="middle" className="floor-label">{label}</text>
      {subtitle && <text x={x} y={y + 23} textAnchor="middle" className="floor-sublabel">{subtitle}</text>}
      {target && <g aria-hidden="true"><circle cx={x} cy={y - 29} r="10" className="floor-target-ring" /><circle cx={x} cy={y - 29} r="4" className="floor-target-dot" /></g>}
    </g>;
  };
  return <svg className="venue-floorplan" viewBox={floor === 'ground' ? '0 0 800 520' : '0 0 800 430'} aria-label={floor === 'ground' ? 'Erdgeschoss: Seitenflügel links, Main Stage mittig, Restaurant rechts und Foyer am Eingang' : 'Obergeschoss: Lounge mittig, Roundtables rechts, Buffet links'}>
    {floor === 'ground' ? <>
      <path className="floor-corridor" d="M30 80H350V100H375V370H565V170H590V150H765V460H355V170H30Z" />
      <text x="202" y="123" textAnchor="middle" className="floor-area-label">SEITENFLÜGEL</text>
      {room('breakout-1', <rect x="30" y="35" width="73" height="136" rx="5" />, 66, 110, '#1')}
      {room('breakout-2', <rect x="113" y="35" width="105" height="62" rx="5" />, 165, 75, '#2')}
      {room('breakout-3', <rect x="228" y="35" width="122" height="62" rx="5" />, 289, 75, '#3')}
      {room('breakout-4', <rect x="228" y="135" width="122" height="62" rx="5" />, 289, 175, '#4')}
      <path className="floor-unused" d="M113 135H218V197H113Z" />
      {room('main', <path d="M385 100H555L565 350Q470 384 375 350Z" />, 470, 240, 'Main Stage', 'Auditorium')}
      <path className="floor-stage" d="M385 100H555V150Q470 183 385 150Z" /><text x="470" y="132" textAnchor="middle" className="floor-sublabel">BÜHNE</text>
      <text x="677" y="107" textAnchor="middle" className="floor-area-label">RESTAURANT</text>
      {room('breakout-5', <rect x="590" y="123" width="82" height="75" rx="5" />, 631, 172, '#5')}
      {room('breakout-6', <rect x="682" y="123" width="83" height="75" rx="5" />, 723, 172, '#6')}
      {room('yard', <rect x="590" y="215" width="125" height="145" rx="5" />, 652, 291, 'Innenhof')}
      <path className="floor-unused" d="M730 215H765V360H730Z" />
      {room('foyer', <path d="M375 380H565V460H375Z" />, 470, 423, 'Foyer')}
      <text x="362" y="421" textAnchor="middle" transform="rotate(-90 362 421)" className="floor-sublabel">Buffet 1</text>
      {room('toilets', <rect x="590" y="380" width="125" height="80" rx="5" />, 652, 426, 'WC')}
      <path className="floor-stairs" d="M537 388H568M541 398H568M545 408H568M549 418H568" />
      <text x="557" y="447" textAnchor="middle" className="floor-sublabel">↑ OG</text>
      <path className="floor-entrance" d="M470 505V476M460 486L470 476L480 486" />
      <text x="450" y="504" textAnchor="end" className="floor-sublabel">Eingang · öffentlicher Platz</text>
    </> : <>
      <path className="floor-corridor" d="M190 60Q400 90 615 30L630 190H585V375H160V195H180Z" />
      <text x="365" y="119" textAnchor="middle" className="floor-area-label">FOYER · OBERGESCHOSS</text>
      {room('roundtables', <path d="M470 79L600 57L612 176H470Z" />, 538, 128, 'Roundtables', '& Networking')}
      {room('lounge', <rect x="270" y="201" width="230" height="125" rx="50" />, 385, 265, 'Lounge', '& Networking')}
      <text x="205" y="273" transform="rotate(-90 205 273)" textAnchor="middle" className="floor-label">Buffet 2</text>
      <text x="350" y="164" textAnchor="middle" className="floor-sublabel">Arcade</text>
      <text x="542" y="353" textAnchor="middle" className="floor-sublabel">Fotowand</text>
      <path className="floor-stairs" d="M535 210H580M542 222H580M549 234H580M556 246H580" />
      <text x="559" y="281" textAnchor="middle" className="floor-sublabel">↓ Foyer</text>
    </>}
  </svg>;
}
