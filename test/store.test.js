import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JsonStore } from '../src/store.js';

test('le stockage persiste puis recharge une session', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pp-fortnite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sessions.json');
  const session = { id: 'ABCDEF12', guildId: 'g', players: [] };
  await (await new JsonStore(file).load()).set(session);
  assert.deepEqual((await new JsonStore(file).load()).get(session.id).players, []);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 1);
});
test('le stockage refuse un JSON corrompu au lieu d’effacer les données', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pp-fortnite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sessions.json'); await writeFile(file, '{cassé');
  await assert.rejects(() => new JsonStore(file).load(), /Stockage illisible/);
});
test('un ancien fichier de sessions est migré sans perdre les propriétaires', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pp-fortnite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'sessions.json');
  await writeFile(file, JSON.stringify({ sessions: { ABCDEF12: { id: 'ABCDEF12', guild: 'g', owner: 'o', private: true, players: [] } } }));
  const session = (await new JsonStore(file).load()).get('ABCDEF12');
  assert.equal(session.guildId, 'g'); assert.equal(session.ownerId, 'o'); assert.equal(session.privateCode, true);
});
