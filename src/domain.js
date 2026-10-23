import { randomBytes } from 'node:crypto';
import { CATEGORIES, REGIONS, STATUS, TERMINAL_STATUSES } from './config.js';

export class DomainError extends Error {
  constructor(code, message) { super(message); this.name = 'DomainError'; this.code = code; }
}
const CODE_RE = /^[A-Z0-9_-]{4,16}$/;
const ID_RE = /^[A-F0-9]{8}$/;

export function normalizeId(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!ID_RE.test(id)) throw new DomainError('BAD_ID', 'Identifiant de session invalide.');
  return id;
}
export function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new DomainError('BAD_CODE', 'Le code doit contenir 4 à 16 lettres, chiffres, tirets ou underscores.');
  return code;
}
export function validateSelection(category, mode, region) {
  if (!CATEGORIES[category]) throw new DomainError('BAD_CATEGORY', 'Catégorie inconnue.');
  if (!CATEGORIES[category].modes.includes(mode)) throw new DomainError('BAD_MODE', `Le mode ${mode} n’est pas disponible en ${CATEGORIES[category].label}.`);
  if (!REGIONS.includes(region)) throw new DomainError('BAD_REGION', 'Région inconnue.');
}
export function createSession(input, now = Date.now()) {
  validateSelection(input.category, input.mode, input.region);
  const id = (input.id || randomBytes(4).toString('hex')).toUpperCase();
  const code = input.code ? normalizeCode(input.code) : randomBytes(4).toString('hex').toUpperCase();
  return { id, guildId: input.guildId, ownerId: input.ownerId, channelId: input.channelId, messageId: null,
    category: input.category, mode: input.mode, region: input.region, code, privateCode: Boolean(input.privateCode),
    players: [], status: STATUS.OPEN, createdAt: now, updatedAt: now, lastAnnouncementAt: null };
}
export function togglePlayer(session, userId, maxPlayers, now = Date.now()) {
  if (session.status !== STATUS.OPEN) throw new DomainError('REGISTRATION_CLOSED', 'Les inscriptions ne sont pas ouvertes.');
  const index = session.players.indexOf(userId);
  if (index >= 0) session.players.splice(index, 1);
  else {
    if (session.players.length >= maxPlayers) throw new DomainError('FULL', 'Cette session est complète.');
    session.players.push(userId);
  }
  session.updatedAt = now;
  return index < 0;
}
export function transitionSession(session, nextStatus, now = Date.now()) {
  if (!Object.values(STATUS).includes(nextStatus)) throw new DomainError('BAD_STATUS', 'État de session invalide.');
  if (TERMINAL_STATUSES.has(session.status) && nextStatus !== STATUS.OPEN) throw new DomainError('TERMINAL', 'Cette session est terminée. Réouvre-la avant de la modifier.');
  session.status = nextStatus; session.updatedAt = now; return session;
}
export function visibleCode(session, manager) { return session.privateCode && !manager ? null : session.code; }
