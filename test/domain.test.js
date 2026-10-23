import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommand } from '../src/commands.js';
import { createSession, DomainError, normalizeCode, togglePlayer, transitionSession, visibleCode } from '../src/domain.js';
import { STATUS } from '../src/config.js';

const make = (extra = {}) => createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: 'o', channelId: 'c', category: 'br', mode: 'Duo', region: 'Europe', code: 'MATCH_42', ...extra }, 100);

test('la commande expose exactement les quatre sous-commandes prévues', () => {
  const json = buildCommand().toJSON();
  assert.deepEqual(json.options.map((option) => option.name), ['creer', 'liste', 'voir', 'annuler']);
  assert.equal(json.dm_permission, false);
});
test('la matrice catégorie/mode refuse une combinaison invalide', () => {
  assert.throws(() => make({ category: 'og', mode: 'Trio' }), (error) => error instanceof DomainError && error.code === 'BAD_MODE');
  assert.equal(make({ category: 'reload', mode: 'Solo' }).mode, 'Solo');
});
test('les codes sont normalisés et strictement validés', () => {
  assert.equal(normalizeCode(' abc-12 '), 'ABC-12');
  assert.throws(() => normalizeCode('@everyone'), /4 à 16/);
});
test('rejoindre et quitter ne crée aucun doublon', () => {
  const session = make();
  assert.equal(togglePlayer(session, 'u1', 2, 101), true);
  assert.deepEqual(session.players, ['u1']);
  assert.equal(togglePlayer(session, 'u1', 2, 102), false);
  assert.deepEqual(session.players, []);
});
test('une session pleine refuse un joueur supplémentaire', () => {
  const session = make(); togglePlayer(session, 'u1', 1);
  assert.throws(() => togglePlayer(session, 'u2', 1), (error) => error.code === 'FULL');
});
test('les inscriptions fermées refusent les changements', () => {
  const session = make(); transitionSession(session, STATUS.READY);
  assert.throws(() => togglePlayer(session, 'u1', 10), (error) => error.code === 'REGISTRATION_CLOSED');
});
test('une session terminale doit être réouverte explicitement', () => {
  const session = make(); transitionSession(session, STATUS.CANCELLED);
  assert.throws(() => transitionSession(session, STATUS.RUNNING), (error) => error.code === 'TERMINAL');
  assert.throws(() => transitionSession(session, STATUS.OPEN), (error) => error.code === 'TERMINAL');
});
test('un code privé reste invisible aux non-gestionnaires', () => {
  const session = make({ privateCode: true });
  assert.equal(visibleCode(session, false), null); assert.equal(visibleCode(session, true), 'MATCH_42');
});

test('une demande est séparée de l’hôte Fortnite et utilise 2 minutes par défaut', () => {
  const s=make({ requested:true, hostId:'creator123' });
  assert.equal(s.status,STATUS.REQUESTED);
  assert.equal(s.ownerId,'o');
  assert.equal(s.hostId,'creator123');
  assert.equal(s.durationMinutes,2);
});
test('les délais sont limités à 3 minutes hors rôle spécial', async () => {
  const { validateDelay, openQueue, parseMode }=await import('../src/domain.js');
  assert.equal(validateDelay(null,false),2);
  assert.throws(()=>validateDelay(5,false),/1 à 3/);
  assert.equal(validateDelay(5,true),5);
  const mode=parseMode('reload:Solo');
  assert.deepEqual(mode,{category:'reload',mode:'Solo'});
  const s=make({requested:true,durationMinutes:2});
  openQueue(s,1000);
  assert.equal(s.queueEndsAt,121000);
  assert.equal(s.status,STATUS.OPEN);
});
