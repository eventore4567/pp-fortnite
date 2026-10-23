import path from 'node:path';
export const CATEGORIES = Object.freeze({
  br: { label: 'BR Construction', emoji: '🪂', modes: ['Solo','Duo','Trio','Section'] },
  br_zero: { label: 'BR Zéro construction', emoji: '🪂', modes: ['Solo','Duo','Trio','Section'] },
  og: { label: 'OG Construction', emoji: '📼', modes: ['Solo','Duo','Section'] },
  og_zero: { label: 'OG Zéro construction', emoji: '📼', modes: ['Solo','Duo','Section'] },
  reload: { label: 'Recharge Construction', emoji: '🔄', modes: ['Solo','Duo','Trio','Section'] },
  reload_zero: { label: 'Recharge Zéro construction', emoji: '🔄', modes: ['Solo','Duo','Trio','Section'] },
  blitz: { label: 'Blitz', emoji: '⚡', modes: ['Solo','Duo','Section'] },
});
export const REGIONS = Object.freeze(['Europe','NA-East','NA-West','NA-Central','Brazil','Asia','Oceania','Middle East']);
export const STATUS = Object.freeze({ REQUESTED:'en_attente', OPEN:'ouverte', READY:'prete', RUNNING:'en_cours', COMPLETED:'terminee', CANCELLED:'annulee' });
export const TERMINAL_STATUSES = new Set([STATUS.COMPLETED, STATUS.CANCELLED]);
export const MODE_OPTIONS = Object.freeze(Object.entries(CATEGORIES).flatMap(([category, data]) => data.modes.map(mode => ({name: `${data.emoji} ${data.label} · ${mode}`, value: `${category}:${mode}`}))));
const EMOJI_KEYS = ['brand','join','players','code','launch','manage','open','ready','running','completed','announce','cancel','region','host','session'];
function integer(name,fallback,min,max) {
  const raw=process.env[name];
  if(raw===undefined || !/^\d+$/.test(raw)) return fallback;
  const n=Number(raw);
  return Number.isSafeInteger(n)&&n>=min&&n<=max?n:fallback;
}
const id = v => /^\d{17,20}$/.test(v||'') ? v : null;
export function getConfig() {
  return {
    token:process.env.DISCORD_TOKEN, clientId:process.env.DISCORD_CLIENT_ID, guildId:id(process.env.DISCORD_GUILD_ID),
    creatorDiscordId:id(process.env.PP_CREATOR_DISCORD_ID), extendedDelayRoleId:id(process.env.PP_EXTENDED_DELAY_ROLE_ID),
    dataFile:path.resolve(process.env.DATA_FILE||'./data/sessions.json'),
    bannerUrl:/^https:\/\//.test(process.env.PP_BANNER_URL||'')?process.env.PP_BANNER_URL:null,
    accentColor:integer('PP_ACCENT_COLOR',0x7564cd,0,0xffffff),
    maxPlayers:integer('PP_MAX_PLAYERS',100,2,100),
    announceCooldownMs:integer('PP_ANNOUNCE_COOLDOWN_SECONDS',60,10,3600)*1000,
    emojis:Object.fromEntries(EMOJI_KEYS.map(key=>[key,process.env[`PP_EMOJI_${key.toUpperCase()}`]||null])),
  };
}