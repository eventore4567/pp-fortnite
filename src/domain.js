import { randomBytes } from 'node:crypto';
import { CATEGORIES, MODE_OPTIONS, REGIONS, STATUS, TERMINAL_STATUSES } from './config.js';

export class DomainError extends Error {
  constructor(code,message) { super(message); this.name='DomainError'; this.code=code; }
}
const CODE_RE=/^[A-Z0-9_-]{4,16}$/;
const ID_RE=/^[A-F0-9]{8}$/;
export function normalizeId(value) {
  const id=String(value||'').trim().toUpperCase();
  if(!ID_RE.test(id)) throw new DomainError('BAD_ID','Identifiant de PP invalide.');
  return id;
}
export function normalizeCode(value) {
  const code=String(value||'').trim().toUpperCase();
  if(!CODE_RE.test(code)) throw new DomainError('BAD_CODE','Code invalide : 4 à 16 lettres, chiffres, tirets ou underscores.');
  return code;
}
export function parseMode(value) {
  const option=MODE_OPTIONS.find(item=>item.value===value);
  if(!option) throw new DomainError('BAD_MODE','Mode indisponible. Choisis un mode proposé dans /pp creer.');
  const [category,mode]=option.value.split(':');
  return {category,mode};
}
export function validateSelection(category,mode,region) {
  if(!CATEGORIES[category]) throw new DomainError('BAD_CATEGORY','Catégorie inconnue.');
  if(!CATEGORIES[category].modes.includes(mode)) throw new DomainError('BAD_MODE',`Le mode ${mode} n’est pas disponible en ${CATEGORIES[category].label}.`);
  if(!REGIONS.includes(region)) throw new DomainError('BAD_REGION','Région inconnue.');
}
export function validateDelay(value,extended=false) {
  const delay=value??2, max=extended?5:3;
  if(!Number.isInteger(delay)||delay<1||delay>max) throw new DomainError('BAD_DELAY',`Délai autorisé : 1 à ${max} minutes${extended?'':' (5 avec le rôle spécial)'}.`);
  return delay;
}
export function createSession(input,now=Date.now()) {
  validateSelection(input.category,input.mode,input.region);
  const id=(input.id||randomBytes(4).toString('hex')).toUpperCase();
  return {
    id,guildId:input.guildId,ownerId:input.ownerId,hostId:input.hostId||input.ownerId,
    channelId:input.channelId,messageId:null,category:input.category,mode:input.mode,region:input.region,
    code:input.code?normalizeCode(input.code):null,
    privateCode:input.privateCode!==false,
    durationMinutes:validateDelay(input.durationMinutes,input.extendedDelay===true),
    queueEndsAt:null,players:[],status:input.requested?STATUS.REQUESTED:STATUS.OPEN,
    createdAt:now,updatedAt:now,lastAnnouncementAt:null
  };
}
export function togglePlayer(session,userId,maxPlayers,now=Date.now()) {
  if(session.status!==STATUS.OPEN||(session.queueEndsAt&&now>=session.queueEndsAt))
    throw new DomainError('REGISTRATION_CLOSED','La file n’est pas ouverte ou le délai est écoulé.');
  const index=session.players.indexOf(userId);
  if(index>=0) session.players.splice(index,1);
  else {
    if(session.players.length>=maxPlayers) throw new DomainError('FULL','Cette PP est complète.');
    session.players.push(userId);
  }
  session.updatedAt=now;
  return index<0;
}
export function transitionSession(session,nextStatus,now=Date.now()) {
  if(!Object.values(STATUS).includes(nextStatus)) throw new DomainError('BAD_STATUS','État de PP invalide.');
  if(TERMINAL_STATUSES.has(session.status)&&nextStatus!==STATUS.REQUESTED)
    throw new DomainError('TERMINAL','Cette PP est clôturée. Crée une nouvelle demande.');
  session.status=nextStatus; session.updatedAt=now;
  if(nextStatus!==STATUS.OPEN) session.queueEndsAt=null;
  return session;
}
export function openQueue(session,now=Date.now()) {
  if(TERMINAL_STATUSES.has(session.status)||session.status===STATUS.RUNNING)
    throw new DomainError('BAD_STATUS','Impossible d’ouvrir la file pour cette PP.');
  session.status=STATUS.OPEN;
  session.queueEndsAt=now+(session.durationMinutes||2)*60_000;
  session.updatedAt=now;
  return session;
}
export function visibleCode(session,manager) { return session.privateCode&&!manager?null:(session.code||null); }