import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/domain.js';
import { sessionView } from '../src/ui.js';

test('le panneau masque le code privé et conserve les actions dans les composants', () => {
  const session = createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: 'o', channelId: 'c', category: 'og', mode: 'Solo', region: 'Europe', code: 'SECRET', privateCode: true });
  const view = sessionView(session, { accentColor: 0x123456, maxPlayers: 100, bannerUrl: 'https://example.com/banner.png' });
  const embed = view.embeds[0].toJSON();
  assert.match(embed.fields.find((field) => field.name === 'CODE PRÉPARATOIRE').value, /Privé/);
  assert.equal(embed.image.url, 'https://example.com/banner.png');
  assert.deepEqual(view.components[0].components.map((button) => button.data.custom_id.split(':')[1]), ['join', 'roster', 'code', 'launch']);
});
