import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { CATEGORIES, getConfig, STATUS, TERMINAL_STATUSES } from './config.js';
import { buildCommand } from './commands.js';
import { createSession, DomainError, normalizeId, togglePlayer, transitionSession } from './domain.js';
import { JsonStore } from './store.js';
import { announcementView, codeView, feedbackView, listView, rosterView, sessionView } from './ui.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const safeReply = (i, payload) => i.replied || i.deferred ? i.followUp(payload) : i.reply(payload);
const canManage = (i, s, config) => (config.creatorDiscordId !== null && i.user.id === config.creatorDiscordId) || i.user.id === s.ownerId || i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || i.memberPermissions?.has(PermissionFlagsBits.ManageEvents);
function requireGuild(i) { if (!i.inGuild()) throw new DomainError('GUILD_ONLY', 'Cette action est disponible uniquement dans un serveur.'); }
function getSession(i, store, rawId) {
  const session = store.get(normalizeId(rawId));
  if (!session || session.guildId !== i.guildId) throw new DomainError('NOT_FOUND', 'Session introuvable dans ce serveur.');
  return session;
}

async function refreshSessionMessage(client, session, config) {
  if (!session.channelId || !session.messageId) return false;
  try {
    const channel = await client.channels.fetch(session.channelId);
    if (!channel?.isTextBased() || !channel.messages) return false;
    const message = await channel.messages.fetch(session.messageId);
    await message.edit(sessionView(session, config));
    return true;
  } catch (error) {
    console.warn(`[panel] Impossible d’actualiser ${session.id}:`, error.message);
    return false;
  }
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
    await i.reply({ embeds: [listView(sessions, config)], flags: EPHEMERAL }); return;
  }
  const session = getSession(i, store, i.options.getString('id', true));
  if (sub === 'voir') { await i.reply({ ...sessionView(session, config), flags: EPHEMERAL }); return; }
  if (!canManage(i, session, config)) throw new DomainError('FORBIDDEN', 'Seul l’hôte ou un membre autorisé peut annuler cette session.');
  transitionSession(session, STATUS.CANCELLED); await store.set(session);
  await refreshSessionMessage(i.client, session, config);
  await i.reply({ embeds: [feedbackView('Session annulée', `La session \`${session.id}\` est désormais fermée.`, config, 'danger')], flags: EPHEMERAL });
}

async function handleButton(i, store, config) {
  requireGuild(i); const [, action, rawId] = i.customId.split(':'); const session = getSession(i, store, rawId);
  if (action === 'roster') {
    await i.reply({ embeds: [rosterView(session, config)], flags: EPHEMERAL, allowedMentions: { parse: [] } }); return;
  }
  if (action !== 'join') throw new DomainError('BAD_ACTION', 'Action inconnue.');
  const joined = togglePlayer(session, i.user.id, config.maxPlayers); await store.set(session);
  await i.update(sessionView(session, config));
  await i.followUp({ embeds: [feedbackView(joined ? 'Inscription confirmée' : 'Départ enregistré', joined ? `Tu participes maintenant à la session \`${session.id}\`.` : `Tu as quitté la session \`${session.id}\`.`, config, joined ? 'success' : 'info')], flags: EPHEMERAL });
}

async function handleMenu(i, store, config) {
  requireGuild(i); const [, action, rawId] = i.customId.split(':');
  if (action !== 'manage') throw new DomainError('BAD_ACTION', 'Action inconnue.');
  const session = getSession(i, store, rawId);
  if (!canManage(i, session, config)) throw new DomainError('FORBIDDEN', 'Cette action est réservée à l’hôte ou aux gestionnaires.');
  const selected = i.values[0];
  if (selected === 'reveal_code') {
    await i.reply({ embeds: [codeView(session, true, config)], flags: EPHEMERAL, allowedMentions: { parse: [] } }); return;
  }
  if (selected === 'announce') {
    const now = Date.now(); const remaining = config.announceCooldownMs - (now - (session.lastAnnouncementAt || 0));
    if (remaining > 0) throw new DomainError('COOLDOWN', `Attends encore ${Math.ceil(remaining / 1000)} seconde(s) avant une nouvelle annonce.`);
    session.lastAnnouncementAt = now; session.updatedAt = now; await store.set(session);
    await i.reply({ embeds: [announcementView(session, config)], allowedMentions: { parse: [] } }); return;
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
      if (i.isAutocomplete() && i.commandName === 'pp') {
        const category = i.options.getString('categorie');
        const typed = String(i.options.getFocused() || '').toLowerCase();
        const modes = CATEGORIES[category]?.modes || [];
        await i.respond(modes.filter((mode) => mode.toLowerCase().includes(typed)).map((mode) => ({ name: mode, value: mode }))); return;
      }
      if (i.isChatInputCommand() && i.commandName === 'pp') await handleCommand(i, store, config);
      else if (i.isButton() && i.customId.startsWith('pp:')) await handleButton(i, store, config);
      else if (i.isStringSelectMenu() && i.customId.startsWith('pp:')) await handleMenu(i, store, config);
    } catch (error) {
      const expected = error instanceof DomainError; if (!expected) console.error('[interaction]', error);
      if (i.isRepliable()) await safeReply(i, { embeds: [feedbackView(expected ? 'Action impossible' : 'Erreur interne', expected ? error.message : 'Réessaie dans un instant. Si le problème persiste, contacte un administrateur.', config, 'danger')], flags: EPHEMERAL }).catch(() => {});
    }
  });
  client.once(Events.ClientReady, () => console.log(`[ready] ${client.user.tag} • commandes ${config.guildId ? 'serveur' : 'globales'} • ${store.values().length} session(s)`));
  client.on('error', (error) => console.error('[discord]', error)); await client.login(config.token); return { client, store };
}
