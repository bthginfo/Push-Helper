import type { RoomData } from './types';
import { normalizeMessages } from './chat';
import { normalizeFavorites } from './people';

/** Updates and chat sends (with a stable message ID) are idempotent; creation must never be replayed. */
export async function plannerRequest(room: string | null, body?: unknown): Promise<RoomData & { room?: string }> {
  const canRetry = !body || (body as { action?: string }).action !== 'create';
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 25_000);
    try {
      const response = await fetch('/api/rooms', { method: body ? 'POST' : 'GET', credentials: 'same-origin',
        headers: { ...(room ? { 'X-Room-Key': room } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => ({ error: `Der Server antwortet nicht korrekt (HTTP ${response.status}). Bitte erneut versuchen.` }));
      if (canRetry && attempt < 2 && response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(data?.error || `Der Plan konnte nicht geladen werden (HTTP ${response.status}).`);
      if (!data?.favorites || !Array.isArray(data.favorites.you) || !Array.isArray(data.favorites.daniel) || typeof data.name !== 'string') {
        throw new Error('Der Server hat einen unvollständigen Plan zurückgegeben. Bitte erneut laden.');
      }
      return { ...data, favorites: normalizeFavorites(data.favorites), messages: normalizeMessages(data.messages) };
    } finally { clearTimeout(timeout); }
  }
}
