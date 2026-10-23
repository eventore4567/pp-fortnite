import path from 'node:path';

export const CATEGORIES = Object.freeze({
  br: { label: 'Battle Royale', emoji: '🏝️', modes: ['Solo', 'Duo', 'Trio', 'Section'] },
  og: { label: 'Fortnite OG', emoji: '🕰️', modes: ['Solo', 'Duo', 'Section'] },
  reload: { label: 'Recharge', emoji: '⚡', modes: ['Duo', 'Section'] },
  blitz: { label: 'Blitz', emoji: '🌩️', modes: ['Solo', 'Duo', 'Section'] },
});
export const REGIONS = Object.freeze(['Europe', 'NA-East', 'NA-West', 'NA-Central', 'Brazil', 'Asia', 'Oceania', 'Middle East']);
export const STATUS = Object.freeze({ OPEN: 'ouverte', READY: 'prete', RUNNING: 'en_cours', COMPLETED: 'terminee', CANCELLED: 'annulee' });
export const TERMINAL_STATUSES = new Set([STATUS.COMPLETED, STATUS.CANCELLED]);

const EMOJI_KEYS = Object.freeze(['brand', 'join', 'players', 'code', 'launch', 'manage', 'open', 'ready', 'running', 'completed', 'announce', 'cancel', 'region', 'host', 'session']);

function integer(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
export function getConfig() {
  return {
    token: process.env.DISCORD_TOKEN, clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
    creatorDiscordId: /^\d{17,20}$/.test(process.env.PP_CREATOR_DISCORD_ID || '') ? process.env.PP_CREATOR_DISCORD_ID : null,
    dataFile: path.resolve(process.env.DATA_FILE || './data/sessions.json'),
    bannerUrl: process.env.PP_BANNER_URL || null,
    accentColor: integer('PP_ACCENT_COLOR', 0x6d5dfc, 0, 0xffffff),
    maxPlayers: integer('PP_MAX_PLAYERS', 100, 2, 100),
    announceCooldownMs: integer('PP_ANNOUNCE_COOLDOWN_SECONDS', 60, 10, 3600) * 1000,
    emojis: Object.fromEntries(EMOJI_KEYS.map((key) => [key, process.env[`PP_EMOJI_${key.toUpperCase()}`] || null])),
  };
}
