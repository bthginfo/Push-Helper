export type Profile = 'you' | 'daniel';
export type SessionType = 'Keynote' | 'Talk' | 'Breakout' | 'Lightning Talks' | 'Roundtable' | 'Pause' | 'Networking' | 'Organisation';
export interface Speaker { name:string; role:string; company:string; bio:string; image:string }
export interface Session { id:string; day:'2026-10-22'|'2026-10-23'; start:string; end:string; endEstimated:boolean; title:string; type:SessionType; room:string; group?:'A'|'B'; speakers:Speaker[]; tldr:string; description:string[]; sourceUrl:string; tags:string[]; bookingRequired:boolean }
export interface RoomData { name:string; favorites:Record<Profile,string[]>; version:string }
