import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/domain.js';
import { announcementView, codeView, launchHelpView, listView, rosterView, sessionView } from '../src/ui.js';

test('le panneau masque le code privé et conserve les actions dans les composants', () => {
  const session = createSession({ id: 'ABCDEF12', guildId: 'g', ownerId: 'o', channelId: 'c', category: 'og', mode: 'Solo', region: 'Europe', code: 'SECRET', privateCode: true });
  const view = sessionView(session, { accentColor: 0x123456, maxPlayers: 100, bannerUrl: 'https://example.com/banner.png' });
  const embed = view.embeds[0].toJSON();
  assert.match(embed.fields.find((field) => field.name.includes('CODE')).value, /Privé/);
  assert.equal(embed.image.url, 'https://example.com/banner.png');
  assert.deepEqual(view.components[0].components.map((button) => button.data.custom_id.split(':')[1]), ['join', 'roster']);
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

test('la bannière intégrée est un PNG horizontal ultra-fin', async () => {
  const { BANNER_PNG }=await import('../src/banner.js');
  assert.equal(BANNER_PNG.subarray(1,4).toString('ascii'),'PNG');
  assert.equal(BANNER_PNG.readUInt32BE(16),1024);
  assert.equal(BANNER_PNG.readUInt32BE(20),72);
});
test('la demande et le lancement annoncent distinctement les états', () => {
  const config={accentColor:0x7564cd,maxPlayers:100,emojis:{}};
  const session=createSession({id:'ABCDEF12',guildId:'g',ownerId:'123456789012345678',hostId:'1563237640655085670',channelId:'c',category:'reload',mode:'Solo',region:'Europe',requested:true});
  const payload=sessionView(session,config);
  assert.match(payload.embeds[0].toJSON().description,/Demandée par/);
  assert.match(payload.embeds[0].toJSON().fields.find(f=>f.name.includes('HÔTE')).value,/1563237640655085670/);
  assert.equal(payload.files.length,1);
  assert.match(announcementView(session,config,'launch').toJSON().title,/Partie lancée/);
});

test('nouveau panneau V2 place la bannière avant le contenu et les contrôles', async () => {
  const { panelView }=await import('../src/ui.js');
  const { MessageFlags }=await import('discord.js');
  const session=createSession({id:'ABCDEF12',guildId:'g',ownerId:'123456789012345678',hostId:'1563237640655085670',channelId:'c',category:'br_zero',mode:'Duo',region:'Europe',requested:true});
  const payload=panelView(session,{maxPlayers:100,emojis:{}});
  assert.equal(payload.flags,MessageFlags.IsComponentsV2);
  const data=payload.components[0].toJSON();
  assert.equal(data.components[0].type,12);
  assert.equal(data.components[0].items[0].media.url,'attachment://pp-banner.png');
  assert.match(JSON.stringify(data),/1563237640655085670/);
});
