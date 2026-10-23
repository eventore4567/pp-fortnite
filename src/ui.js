import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CATEGORIES, STATUS, TERMINAL_STATUSES } from './config.js';

const STATUS_VIEW = {
  [STATUS.OPEN]: ['🟢', 'Inscriptions ouvertes'], [STATUS.READY]: ['🟠', 'Inscriptions fermées'],
  [STATUS.RUNNING]: ['🔵', 'Partie en cours (suivi manuel)'], [STATUS.COMPLETED]: ['🏁', 'Session terminée'],
  [STATUS.CANCELLED]: ['🔴', 'Session annulée'],
};
export function sessionView(session, config) {
  const category = CATEGORIES[session.category];
  const status = STATUS_VIEW[session.status] || ['⚪', session.status];
  const terminal = TERMINAL_STATUSES.has(session.status);
  const embed = new EmbedBuilder().setColor(session.status === STATUS.CANCELLED ? 0x555866 : config.accentColor)
    .setAuthor({ name: 'PP FORTNITE • PRIVATE MATCH HUB' }).setTitle(`${category.emoji} ${category.label}  ·  ${session.mode}`)
    .setDescription(`${status[0]} **${status[1]}**\n\nRejoins la session avec le bouton ci-dessous. L’hôte garde le contrôle du panneau.`)
    .addFields(
      { name: 'RÉGION', value: `🌍 ${session.region}`, inline: true }, { name: 'HÔTE', value: `👑 <@${session.ownerId}>`, inline: true },
      { name: 'JOUEURS', value: `👥 ${session.players.length}/${config.maxPlayers}`, inline: true },
      { name: 'CODE PRÉPARATOIRE', value: session.privateCode ? '🔒 Privé — communiqué par l’hôte' : `\`${session.code}\``, inline: false },
      { name: 'SESSION', value: `\`${session.id}\``, inline: true })
    .setFooter({ text: 'Gestion Discord uniquement • Aucun lancement Epic automatique' }).setTimestamp(session.updatedAt);
  if (config.bannerUrl) embed.setImage(config.bannerUrl);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pp:join:${session.id}`).setLabel('Rejoindre / Quitter').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(terminal || session.status !== STATUS.OPEN),
    new ButtonBuilder().setCustomId(`pp:roster:${session.id}`).setLabel('Participants').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pp:code:${session.id}`).setLabel('Code').setEmoji('🔑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pp:launch:${session.id}`).setLabel('Lancement').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(terminal));
  const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pp:manage:${session.id}`).setPlaceholder('⚙️ Actions de l’hôte').addOptions(
    { label: 'Ouvrir les inscriptions', value: STATUS.OPEN, emoji: '🟢' }, { label: 'Fermer les inscriptions', value: STATUS.READY, emoji: '🟠' },
    { label: 'Marquer en cours', value: STATUS.RUNNING, emoji: '🔵' }, { label: 'Marquer terminée', value: STATUS.COMPLETED, emoji: '🏁' },
    { label: 'Publier une annonce', value: 'announce', emoji: '📣' }, { label: 'Annuler la session', value: STATUS.CANCELLED, emoji: '✖️' }));
  return { embeds: [embed], components: [buttons, menu], allowedMentions: { parse: [], users: [session.ownerId] } };
}
export function listView(sessions) {
  const lines = sessions.slice(0, 25).map((session) => {
    const [emoji, state] = STATUS_VIEW[session.status] || ['⚪', session.status];
    return `${emoji} \`${session.id}\` • **${CATEGORIES[session.category]?.label || session.category} ${session.mode}** • ${state} • ${session.players.length} joueur(s)`;
  });
  return new EmbedBuilder().setColor(0x6d5dfc).setTitle('✦ PP ACTIVES').setDescription(lines.join('\n') || 'Aucune session active.').setFooter({ text: 'Utilise /pp voir avec l’identifiant pour ouvrir un panneau.' });
}
