import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CATEGORIES, STATUS, TERMINAL_STATUSES } from './config.js';

const COLORS = Object.freeze({ neutral: 0x252334, success: 0x7365db, warning: 0xb48ad9, info: 0x6557c9, danger: 0xd65b77 });
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
    .setFooter({ text: 'PP Fortnite  ·  Match Center' });
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
    .setTitle(`${category.emoji}  ${category.label}  ·  ${session.mode}`)
    .setDescription(`${statusIcon} **${status.label}**  ·  ${status.detail}\n\n**PARTIE PERSONNALISÉE**`)
    .addFields(
      { name: `${icon(config, 'region', '🌐')}  RÉGION`, value: `**${session.region}**`, inline: true },
      { name: `${icon(config, 'host', '♛')}  HÔTE`, value: `<@${session.ownerId}>`, inline: true },
      { name: `${icon(config, 'players', '◈')}  JOUEURS`, value: `**${session.players.length} / ${config.maxPlayers}**`, inline: true },
      { name: `${icon(config, 'code', '🔑')}  CODE DE MATCHMAKING`, value: session.privateCode ? '🔒 **Privé** · Visible uniquement par l’hôte et les gestionnaires via le menu ci-dessous' : `\`${session.code}\`  ·  À configurer dans Fortnite par l’hôte`, inline: false },
      { name: `${icon(config, 'session', '⌁')}  SESSION`, value: `\`${session.id}\``, inline: true },
      { name: 'MISE À JOUR', value: `<t:${Math.floor(session.updatedAt / 1000)}:R>`, inline: true })
    .setTimestamp(session.updatedAt);
  // Utiliser une image horizontale très fine (par exemple 1200 × 100) dans PP_BANNER_URL.
  if (config.bannerUrl && /^https:\/\//i.test(config.bannerUrl)) embed.setImage(config.bannerUrl);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pp:join:${session.id}`).setLabel('Participer / quitter').setEmoji(componentEmoji(config, 'join', '🎮')).setStyle(ButtonStyle.Primary).setDisabled(terminal || session.status !== STATUS.OPEN),
    new ButtonBuilder().setCustomId(`pp:roster:${session.id}`).setLabel('Participants').setEmoji(componentEmoji(config, 'players', '👥')).setStyle(ButtonStyle.Secondary));
  const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`pp:manage:${session.id}`).setPlaceholder('⚙️  Gestion de la PP').setMinValues(1).setMaxValues(1).addOptions(
    { label: 'Ouvrir les inscriptions', description: 'Autoriser les joueurs à rejoindre', value: STATUS.OPEN, emoji: componentEmoji(config, 'open', '🟢') },
    { label: 'Fermer les inscriptions', description: 'Verrouiller la liste des participants', value: STATUS.READY, emoji: componentEmoji(config, 'ready', '🟠') },
    { label: 'Marquer en cours', description: 'Indiquer un lancement manuel', value: STATUS.RUNNING, emoji: componentEmoji(config, 'running', '🔵') },
    { label: 'Terminer la session', description: 'Clôturer cette partie personnalisée', value: STATUS.COMPLETED, emoji: componentEmoji(config, 'completed', '🏁') },
    { label: 'Afficher le code privé', description: 'Visible uniquement par toi, accès réservé aux gestionnaires', value: 'reveal_code', emoji: componentEmoji(config, 'code', '🔑') },
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
    .setDescription(code ? `## \`${code}\`\n🔒 **Message privé : visible uniquement par toi.**\n\nCopie ce code et configure-le dans Fortnite avant de lancer la PP.` : '> Ce code est privé. Demande-le directement à l’hôte.')
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
