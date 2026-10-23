import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CATEGORIES, STATUS, TERMINAL_STATUSES } from './config.js';

const COLORS = Object.freeze({ neutral: 0x121826, success: 0x2ecc71, warning: 0xf0a43c, info: 0x5b8cff, danger: 0xed4245 });
const CUSTOM_EMOJI = /^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/;
const STATUS_VIEW = {
  [STATUS.OPEN]: { key: 'open', fallback: '🟢', label: 'OUVERTE', detail: 'Inscriptions ouvertes', color: COLORS.success },
  [STATUS.READY]: { key: 'ready', fallback: '🟠', label: 'PRÊTE', detail: 'Inscriptions fermées', color: COLORS.warning },
  [STATUS.RUNNING]: { key: 'running', fallback: '🔵', label: 'EN COURS', detail: 'Suivi manuel par l’hôte', color: COLORS.info },
  [STATUS.COMPLETED]: { key: 'completed', fallback: '🏁', label: 'TERMINÉE', detail: 'Session clôturée', color: COLORS.neutral },
  [STATUS.CANCELLED]: { key: 'cancel', fallback: '🔴', label: 'ANNULÉE', detail: 'Session annulée', color: COLORS.danger },
};

function icon(config, key, fallback) {
  const configured = config?.emojis?.[key];
  return configured && CUSTOM_EMOJI.test(configured) ? configured : fallback;
}

function baseEmbed(config, color = config?.accentColor ?? COLORS.info) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${icon(config, 'brand', '✦')}  PP FORTNITE`, iconURL: config?.brandIconUrl || undefined })
    .setFooter({ text: 'PP Fortnite  •  Gestion Discord sécurisée  •  Aucun accès Epic Games' });
}

function componentEmoji(config, key, fallback) {
  return icon(config, key, fallback);
}

export function sessionView(session, config) {
  const category = CATEGORIES[session.category];
  const status = STATUS_VIEW[session.status] || { key: 'session', fallback: '⚪', label: String(session.status).toUpperCase(), detail: session.status, color: config.accentColor };
  const terminal = TERMINAL_STATUSES.has(session.status);
  const statusIcon = icon(config, status.key, status.fallback);
  const embed = baseEmbed(config, status.color)
    .setTitle(`${category.emoji}  ${category.label}  •  ${session.mode}`)
    .setDescription(`### ${statusIcon}  ${status.label}\n${status.detail}\n\n> Utilise les actions ci-dessous pour rejoindre la session ou consulter ses informations.`)
    .addFields(
      { name: `${icon(config, 'region', '🌐')}  RÉGION`, value: `**${session.region}**`, inline: true },
      { name: `${icon(config, 'host', '♛')}  HÔTE`, value: `<@${session.ownerId}>`, inline: true },
      { name: `${icon(config, 'players', '◈')}  JOUEURS`, value: `**${session.players.length} / ${config.maxPlayers}**`, inline: true },
      { name: `${icon(config, 'code', '🔑')}  ACCÈS`, value: session.privateCode ? '`CODE PRIVÉ`  •  communiqué par l’hôte' : `\`${session.code}\`  •  référence préparatoire`, inline: false },
      { name: `${icon(config, 'session', '⌁')}  SESSION`, value: `\`${session.id}\``, inline: true },
      { name: 'MISE À JOUR', value: `<t:${Math.floor(session.updatedAt / 1000)}:R>`, inline: true })
    .setTimestamp(session.updatedAt);
  if (config.bannerUrl) embed.setImage(config.bannerUrl);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pp:join:${session.id}`).setLabel('Rejoindre / quitter').setEmoji(componentEmoji(config, 'join', '🎮')).setStyle(ButtonStyle.Primary).setDisabled(terminal || session.status !== STATUS.OPEN),
    new ButtonBuilder().setCustomId(`pp:roster:${session.id}`).setLabel('Participants').setEmoji(componentEmoji(config, 'players', '👥')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pp:code:${session.id}`).setLabel('Accès').setEmoji(componentEmoji(config, 'code', '🔑')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pp:launch:${session.id}`).setLabel('Instructions').setEmoji(componentEmoji(config, 'launch', '▶️')).setStyle(ButtonStyle.Success).setDisabled(terminal));
  const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pp:manage:${session.id}`).setPlaceholder('Gérer la session').setMinValues(1).setMaxValues(1).addOptions(
    { label: 'Ouvrir les inscriptions', description: 'Autoriser les joueurs à rejoindre', value: STATUS.OPEN, emoji: componentEmoji(config, 'open', '🟢') },
    { label: 'Fermer les inscriptions', description: 'Verrouiller la liste des participants', value: STATUS.READY, emoji: componentEmoji(config, 'ready', '🟠') },
    { label: 'Marquer en cours', description: 'Indiquer un lancement manuel', value: STATUS.RUNNING, emoji: componentEmoji(config, 'running', '🔵') },
    { label: 'Terminer la session', description: 'Clôturer cette partie personnalisée', value: STATUS.COMPLETED, emoji: componentEmoji(config, 'completed', '🏁') },
    { label: 'Publier une annonce', description: 'Relancer la session dans ce salon', value: 'announce', emoji: componentEmoji(config, 'announce', '📣') },
    { label: 'Annuler la session', description: 'Fermer et signaler l’annulation', value: STATUS.CANCELLED, emoji: componentEmoji(config, 'cancel', '✖️') }));
  return { embeds: [embed], components: [buttons, menu], allowedMentions: { parse: [], users: [session.ownerId] } };
}
export function listView(sessions, config = {}) {
  const lines = sessions.slice(0, 25).map((session) => {
    const status = STATUS_VIEW[session.status] || { key: 'session', fallback: '⚪', label: session.status };
    return `${icon(config, status.key, status.fallback)}  **${CATEGORIES[session.category]?.label || session.category} • ${session.mode}**\n↳ \`${session.id}\`  ·  ${session.region}  ·  ${session.players.length} joueur(s)  ·  ${status.label}`;
  });
  return baseEmbed(config).setTitle('Sessions actives').setDescription(lines.join('\n\n') || '> Aucune session active pour le moment.').addFields({ name: 'OUVRIR UN PANNEAU', value: 'Utilise `/pp voir` avec l’identifiant de la session.' });
}

export function rosterView(session, config) {
  const roster = session.players.length
    ? session.players.slice(0, 100).map((id, index) => `\`${String(index + 1).padStart(2, '0')}\`  <@${id}>`).join('\n')
    : '> Aucun joueur inscrit pour le moment.';
  return baseEmbed(config).setTitle(`${icon(config, 'players', '👥')}  Participants • ${session.id}`).setDescription(roster)
    .addFields({ name: 'CAPACITÉ', value: `**${session.players.length} / ${config.maxPlayers}** joueurs`, inline: true }, { name: 'STATUT', value: STATUS_VIEW[session.status]?.label || session.status, inline: true });
}

export function codeView(session, manager, config) {
  const code = !session.privateCode || manager ? session.code : null;
  return baseEmbed(config, code ? config.accentColor : COLORS.warning).setTitle(`${icon(config, 'code', '🔑')}  Accès à la session`)
    .setDescription(code ? `### \`${code}\`\nRéférence préparatoire enregistrée par l’hôte.` : '> Ce code est privé. Demande-le directement à l’hôte.')
    .addFields({ name: 'IMPORTANT', value: 'Ce code ne crée pas de partie Epic Games. Un créateur autorisé doit configurer la partie manuellement dans Fortnite.' });
}

export function launchHelpView(session, config) {
  return baseEmbed(config, COLORS.warning).setTitle(`${icon(config, 'launch', '▶️')}  Lancement manuel requis`)
    .setDescription('### Aucune connexion Epic Games n’est active\nCe panneau Discord ne peut ni créer un code Epic, ni ouvrir un lobby, ni lancer une partie Fortnite.')
    .addFields(
      { name: '1  •  CONFIGURER', value: 'L’hôte crée la partie dans Fortnite avec un compte créateur autorisé.' },
      { name: '2  •  COMMUNIQUER', value: 'L’hôte transmet les informations d’accès aux participants.' },
      { name: '3  •  METTRE À JOUR', value: `L’hôte marque ensuite la session \`${session.id}\` « en cours » depuis le menu Discord.` });
}

export function announcementView(session, config) {
  const category = CATEGORIES[session.category];
  return baseEmbed(config, COLORS.info).setTitle(`${icon(config, 'announce', '📣')}  Une PP est disponible`)
    .setDescription(`### ${category.emoji}  ${category.label} • ${session.mode}\nUne nouvelle session attend ses joueurs. Rejoins-la depuis son panneau officiel.`)
    .addFields({ name: 'RÉGION', value: session.region, inline: true }, { name: 'PLACES', value: `${session.players.length} / ${config.maxPlayers}`, inline: true }, { name: 'SESSION', value: `\`${session.id}\``, inline: true });
}

export function feedbackView(title, description, config, tone = 'success') {
  return baseEmbed(config, COLORS[tone] || COLORS.info).setTitle(title).setDescription(description);
}
