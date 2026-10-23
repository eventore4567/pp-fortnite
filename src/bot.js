import 'dotenv/config';
import { Client, GatewayIntentBits, MessageFlags, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { getConfig, STATUS, TERMINAL_STATUSES } from './config.js';
import { buildCommand } from './commands.js';
import { createSession, DomainError, normalizeId, togglePlayer, transitionSession, visibleCode } from './domain.js';
import { JsonStore } from './store.js';
import { listView, sessionView } from './ui.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const safeReply = (i, payload) => i.replied || i.deferred ? i.followUp(payload) : i.reply(payload);
const canManage = (i, s) => i.user.id === s.ownerId || i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || i.memberPermissions?.has(PermissionFlagsBits.ManageEvents);
function requireGuild(i) { if (!i.inGuild()) throw new DomainError('GUILD_ONLY', 'Cette action est disponible uniquement dans un serveur.'); }
function getSession(i, store, rawId) {
  const session = store.get(normalizeId(rawId));
  if (!session || session.guildId !== i.guildId) throw new DomainError('NOT_FOUND', 'Session introuvable dans ce serveur.');
  return session;
}

async function handleCommand(i, store, config) {
  requireGuild(i); const sub = i.options.getSubcommand();
  if (sub === 'creer') {
    const session = createSession({ guildId: i.guildId, ownerId: i.user.id, channelId: i.channelId,
      category: i.options.getString('categorie', true), mode: i.options.getString('mode', true), region: i.options.getString('region', true),
      code: i.options.getString('code'), privateCode: i.options.getBoolean('privee') ?? false });
    await store.set(session);
    const response = await i.reply({ ...sessionView(session, config), fetchReply: true });
    session.messageId = response.id; await store.set(session); return;
  }
  if (sub === 'liste') {
    const sessions = store.values().filter((s) => s.guildId === i.guildId && !TERMINAL_STATUSES.has(s.status)).sort((a, b) => b.updatedAt - a.updatedAt);
    await i.reply({ embeds: [listView(sessions)], flags: EPHEMERAL }); return;
  }
  const session = getSession(i, store, i.options.getString('id', true));
  if (sub === 'voir') { await i.reply({ ...sessionView(session, config), flags: EPHEMERAL }); return; }
  if (!canManage(i, session)) throw new DomainError('FORBIDDEN', 'Seul l’hôte ou un membre autorisé peut annuler cette session.');
  transitionSession(session, STATUS.CANCELLED); await store.set(session); await i.reply(sessionView(session, config));
}

async function handleButton(i, store, config) {
  requireGuild(i); const [, action, rawId] = i.customId.split(':'); const session = getSession(i, store, rawId);
  if (action === 'roster') {
    const roster = session.players.length ? session.players.map((id, n) => `${n + 1}. <@${id}>`).join('\n') : 'Aucun joueur inscrit.';
    await i.reply({ content: `**Participants • ${session.id}**\n${roster}`, flags: EPHEMERAL, allowedMentions: { parse: [] } }); return;
  }
  if (action === 'code') {
    const code = visibleCode(session, canManage(i, session));
    await i.reply({ content: code ? `Référence préparatoire : \`${code}\`\nÀ configurer manuellement par un créateur autorisé dans Fortnite.` : 'Ce code est privé. Demande-le à l’hôte.', flags: EPHEMERAL }); return;
  }
  if (action === 'launch') {
    if (!canManage(i, session)) throw new DomainError('FORBIDDEN', 'Cette action est réservée à l’hôte ou aux gestionnaires.');
    await i.reply({ content: '⚠️ **Aucune connexion Epic n’est active.** Configure et lance la partie manuellement dans Fortnite avec un compte créateur autorisé, puis marque la session « en cours » via le menu. Ce bouton ne crée aucun code Epic et ne lance aucune partie.', flags: EPHEMERAL }); return;
  }
  if (action !== 'join') throw new DomainError('BAD_ACTION', 'Action inconnue.');
  const joined = togglePlayer(session, i.user.id, config.maxPlayers); await store.set(session);
  await i.update(sessionView(session, config)); await i.followUp({ content: joined ? '✅ Inscription confirmée.' : '↩️ Tu as quitté la session.', flags: EPHEMERAL });
}

async function handleMenu(i, store, config) {
  requireGuild(i); const [, action, rawId] = i.customId.split(':');
  if (action !== 'manage') throw new DomainError('BAD_ACTION', 'Action inconnue.');
  const session = getSession(i, store, rawId);
  if (!canManage(i, session)) throw new DomainError('FORBIDDEN', 'Cette action est réservée à l’hôte ou aux gestionnaires.');
  const selected = i.values[0];
  if (selected === 'announce') {
    const now = Date.now(); const remaining = config.announceCooldownMs - (now - (session.lastAnnouncementAt || 0));
    if (remaining > 0) throw new DomainError('COOLDOWN', `Attends encore ${Math.ceil(remaining / 1000)} seconde(s) avant une nouvelle annonce.`);
    session.lastAnnouncementAt = now; session.updatedAt = now; await store.set(session);
    await i.reply({ content: `📣 **PP ${session.id}** • ${session.mode} • ${session.region}\nUne session est disponible. Utilisez son panneau officiel pour vous inscrire.`, allowedMentions: { parse: [] } }); return;
  }
  transitionSession(session, selected); await store.set(session); await i.update(sessionView(session, config));
}

export async function registerCommands(config, rest = new REST({ version: '10' }).setToken(config.token)) {
  const route = config.guildId ? Routes.applicationGuildCommands(config.clientId, config.guildId) : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body: [buildCommand().toJSON()] });
}
export async function startBot() {
  const config = getConfig();
  if (!config.token || !config.clientId) throw new Error('DISCORD_TOKEN et DISCORD_CLIENT_ID sont obligatoires.');
  const store = await new JsonStore(config.dataFile).load(); await registerCommands(config);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'pp') await handleCommand(i, store, config);
      else if (i.isButton() && i.customId.startsWith('pp:')) await handleButton(i, store, config);
      else if (i.isStringSelectMenu() && i.customId.startsWith('pp:')) await handleMenu(i, store, config);
    } catch (error) {
      const expected = error instanceof DomainError; if (!expected) console.error('[interaction]', error);
      if (i.isRepliable()) await safeReply(i, { content: expected ? `⚠️ ${error.message}` : '❌ Une erreur interne est survenue. Réessaie dans un instant.', flags: EPHEMERAL }).catch(() => {});
    }
  });
  client.once('ready', () => console.log(`[ready] ${client.user.tag} • commandes ${config.guildId ? 'serveur' : 'globales'} • ${store.values().length} session(s)`));
  client.on('error', (error) => console.error('[discord]', error)); await client.login(config.token); return { client, store };
}
