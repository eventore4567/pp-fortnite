import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/domain.js';
import { announcementView, codeView, launchHelpView, listView, rosterView, sessionView } from '../src/ui.js';

test('le panneau masque le code privé et conserve les actions dans les composants', () => {
  const session = createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: 'o', channelId: 'c', category: 'og', mode: 'Solo', region: 'Europe', code: 'SECRET', privateCode: true });
  const view = sessionView(session, { accentColor: 0x123456, maxPlayers: 100, bannerUrl: 'https://example.com/banner.png' });
  const embed = view.embeds[0].toJSON();
  assert.match(embed.fields.find((field) => field.name.includes('ACCÈS')).value, /PRIVÉ/);
  assert.equal(embed.image.url, 'https://example.com/banner.png');
  assert.deepEqual(view.components[0].components.map((button) => button.data.custom_id.split(':')[1]), ['join', 'roster', 'code', 'launch']);
});

test('les vues premium restent valides sans emojis personnalisés', () => {
  const config = { accentColor: 0x123456, maxPlayers: 100, bannerUrl: null, emojis: {} };
  const session = createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: '123456789012345678', channelId: 'c', category: 'br', mode: 'Duo', region: 'Europe', code: 'MATCH42' });
  for (const embed of [listView([session], config), rosterView(session, config), codeView(session, false, config), launchHelpView(session, config), announcementView(session, config)]) {
    assert.doesNotThrow(() => embed.toJSON());
  }
});

test('un emoji personnalisé valide remplace le fallback sur les composants', () => {
  const config = { accentColor: 0x123456, maxPlayers: 100, bannerUrl: null, emojis: { join: '<:ppjoin:123456789012345678>' } };
  const session = createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: 'o', channelId: 'c', category: 'br', mode: 'Duo', region: 'Europe', code: 'MATCH42' });
  assert.equal(sessionView(session, config).components[0].components[0].data.emoji.id, '123456789012345678');
});
