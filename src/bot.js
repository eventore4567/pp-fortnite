import 'dotenv/config';
import { ActionRowBuilder, Client, Events, GatewayIntentBits, MessageFlags, ModalBuilder, PermissionFlagsBits, REST, Routes, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getConfig, MODE_OPTIONS, STATUS, TERMINAL_STATUSES } from './config.js';
import { buildCommand } from './commands.js';
import { createSession, DomainError, normalizeCode, normalizeId, openQueue, parseMode, togglePlayer, transitionSession, validateDelay } from './domain.js';
import { JsonStore } from './store.js';
import { announcementView, codeView, feedbackView, listView, panelView, rosterView, sessionView, withBanner } from './ui.js';

const EPHEMERAL=MessageFlags.Ephemeral;
const timers=new Map();
const safeReply=(i,payload)=>i.replied||i.deferred?i.followUp(payload):i.reply(payload);
const staff=i=>Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)||i.memberPermissions?.has(PermissionFlagsBits.ManageEvents));
const canHost=(i,s,config)=>staff(i)||i.user.id===(s.hostId||s.ownerId)||(Boolean(config.creatorDiscordId)&&i.user.id===config.creatorDiscordId);
const canCancel=(i,s,config)=>i.user.id===s.ownerId||canHost(i,s,config);
const hasRole=(i,id)=>Boolean(id&&(Array.isArray(i.member?.roles)?i.member.roles.includes(id):i.member?.roles?.cache?.has(id)));

function requireGuild(i) {
  if(!i.inGuild()) throw new DomainError('GUILD_ONLY','Cette action doit être utilisée dans un serveur.');
}
function getSession(i,store,rawId) {
  const session=store.get(normalizeId(rawId));
  if(!session||session.guildId!==i.guildId) throw new DomainError('NOT_FOUND','PP introuvable sur ce serveur.');
  return session;
}
async function refreshSessionMessage(client,session,config) {
  if(!session.channelId||!session.messageId)return false;
  try {
    const channel=await client.channels.fetch(session.channelId);
    if(!channel?.isTextBased()||!channel.messages)return false;
    const message=await channel.messages.fetch(session.messageId);
    await message.edit(message.flags?.has(MessageFlags.IsComponentsV2)?panelView(session,config):sessionView(session,config));
    return true;
  } catch(error) {
    console.warn('[panel]',session.id,error.message);
    return false;
  }
}
async function postAnnouncement(client,session,config,kind) {
  try {
    const channel=await client.channels.fetch(session.channelId);
    if(!channel?.isTextBased())return false;
    await channel.send(withBanner(announcementView(session,config,kind),config));
    return true;
  } catch(error) {
    console.warn('[announcement]',session.id,error.message);
    return false;
  }
}
function cancelTimer(id) {
  const timer=timers.get(id);
  if(timer)clearTimeout(timer);
  timers.delete(id);
}
async function expireQueue(client,store,config,id) {
  const s=store.get(id);
  if(!s||s.status!==STATUS.OPEN||!s.queueEndsAt||s.queueEndsAt>Date.now())return;
  transitionSession(s,STATUS.READY);
  await store.set(s);
  await refreshSessionMessage(client,s,config);
  await postAnnouncement(client,s,config,'closed');
  timers.delete(id);
}
function scheduleQueue(client,store,config,s) {
  cancelTimer(s.id);
  if(s.status!==STATUS.OPEN||!s.queueEndsAt)return;
  const delay=Math.max(0,s.queueEndsAt-Date.now());
  const timer=setTimeout(()=>expireQueue(client,store,config,s.id).catch(e=>console.error('[queue]',e)),delay);
  timer.unref?.(); timers.set(s.id,timer);
}
async function command(i,store,config) {
  requireGuild(i);
  const sub=i.options.getSubcommand();
  if(sub==='creer') {
    const {category,mode}=parseMode(i.options.getString('mode',true));
    const extended=staff(i)||hasRole(i,config.extendedDelayRoleId);
    const durationMinutes=validateDelay(i.options.getInteger('delai'),extended);
    const session=createSession({
      guildId:i.guildId,ownerId:i.user.id,hostId:config.creatorDiscordId||i.user.id,
      channelId:i.channelId,category,mode,region:i.options.getString('region')||'Europe',
      code:i.options.getString('code'),privateCode:i.options.getBoolean('prive')??true,
      durationMinutes,extendedDelay:extended,requested:true
    });
    await store.set(session);
    await i.reply(panelView(session,config));
    const reply=await i.fetchReply();
    session.messageId=reply.id;
    await store.set(session);
    return;
  }
  if(sub==='liste') {
    const sessions=store.values().filter(s=>s.guildId===i.guildId&&!TERMINAL_STATUSES.has(s.status)).sort((a,b)=>b.updatedAt-a.updatedAt);
    await i.reply({embeds:[listView(sessions,config)],flags:EPHEMERAL,allowedMentions:{parse:[]}});return;
  }
  const session=getSession(i,store,i.options.getString('id',true));
  if(sub==='voir') {
    await i.reply({...panelView(session,config),flags:EPHEMERAL|MessageFlags.IsComponentsV2});return;
  }
  if(sub!=='annuler')throw new DomainError('BAD_ACTION','Commande inconnue.');
  if(!canCancel(i,session,config))throw new DomainError('FORBIDDEN','Seul le demandeur, l’hôte ou un administrateur peut annuler cette PP.');
  transitionSession(session,STATUS.CANCELLED);cancelTimer(session.id);
  await store.set(session);
  await refreshSessionMessage(i.client,session,config);
  await i.reply({embeds:[feedbackView('❌ PP annulée',`Demande ${session.id} clôturée.`,config,'danger')],flags:EPHEMERAL});
  await postAnnouncement(i.client,session,config,'cancel');
}
async function button(i,store,config) {
  requireGuild(i);
  const [,action,id]=i.customId.split(':');
  const session=getSession(i,store,id);
  if(action==='roster') {
    await i.reply({embeds:[rosterView(session,config)],flags:EPHEMERAL,allowedMentions:{parse:[]}});return;
  }
  if(action!=='join')throw new DomainError('BAD_ACTION','Bouton inconnu.');
  const joined=togglePlayer(session,i.user.id,config.maxPlayers);
  await store.set(session);
  await i.update(i.message?.flags?.has(MessageFlags.IsComponentsV2)?panelView(session,config):sessionView(session,config));
  await refreshSessionMessage(i.client,session,config);
  await i.followUp({embeds:[feedbackView(joined?'✅ Inscription confirmée':'Départ confirmé',
    joined?`Tu es inscrit(e) à la PP ${session.id}.`:`Tu as quitté la PP ${session.id}.`,config)],flags:EPHEMERAL});
}
async function menu(i,store,config) {
  requireGuild(i);
  const [,action,id]=i.customId.split(':');
  if(action!=='manage')throw new DomainError('BAD_ACTION','Menu inconnu.');
  const session=getSession(i,store,id), selected=i.values[0];
  if(selected==='reveal_code') {
    if(!canCancel(i,session,config))throw new DomainError('FORBIDDEN','Code réservé au demandeur et aux gestionnaires.');
    await i.reply({embeds:[codeView(session,true,config)],flags:EPHEMERAL,allowedMentions:{parse:[]}});return;
  }
  if(selected==='set_code') {
    if(!canHost(i,session,config))throw new DomainError('FORBIDDEN','Seul l’hôte Fortnite ou un administrateur peut modifier le code.');
    const modal=new ModalBuilder().setCustomId(`pp:code_modal:${session.id}`).setTitle('Définir le code Fortnite');
    const input=new TextInputBuilder().setCustomId('match_code').setLabel('Code de matchmaking (4-16 caractères)').setStyle(TextInputStyle.Short)
      .setMinLength(4).setMaxLength(16).setRequired(true);
    if(session.code)input.setValue(session.code);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await i.showModal(modal);return;
  }
  if(selected==='cancel') {
    if(!canCancel(i,session,config))throw new DomainError('FORBIDDEN','Annulation réservée au demandeur, à l’hôte et au staff.');
    transitionSession(session,STATUS.CANCELLED);cancelTimer(session.id);
    await store.set(session);await i.update(i.message?.flags?.has(MessageFlags.IsComponentsV2)?panelView(session,config):sessionView(session,config));
    await refreshSessionMessage(i.client,session,config);
    await postAnnouncement(i.client,session,config,'cancel');return;
  }
  if(!canHost(i,session,config))throw new DomainError('FORBIDDEN','Gestion réservée à Minimoys, à l’hôte ou au staff.');
  if(selected==='announce') {
    const now=Date.now(),remaining=config.announceCooldownMs-(now-(session.lastAnnouncementAt||0));
    if(remaining>0)throw new DomainError('COOLDOWN',`Attends encore ${Math.ceil(remaining/1000)} seconde(s).`);
    session.lastAnnouncementAt=now;session.updatedAt=now;await store.set(session);
    await i.reply({embeds:[feedbackView('📣 Annonce envoyée','Le rappel a été publié dans le salon.',config)],flags:EPHEMERAL});
    await postAnnouncement(i.client,session,config,'reminder');return;
  }
  let announcement=null;
  if(selected==='queue_open') {
    if(!session.code)throw new DomainError('CODE_REQUIRED','Définis d’abord un code via « Définir / modifier le code ».');
    openQueue(session);announcement='queue';
  } else if(selected==='queue_close') {
    if(session.status!==STATUS.OPEN)throw new DomainError('BAD_STATUS','La file n’est pas ouverte.');
    transitionSession(session,STATUS.READY);announcement='closed';
  } else if(selected==='launch') {
    if(!session.code)throw new DomainError('CODE_REQUIRED','L’hôte doit d’abord définir le code Fortnite.');
    if(![STATUS.OPEN,STATUS.READY].includes(session.status))
      throw new DomainError('BAD_STATUS','Ouvre d’abord la file avant de confirmer un lancement.');
    transitionSession(session,STATUS.RUNNING);announcement='launch';
  } else if(selected==='complete') {
    if(session.status!==STATUS.RUNNING)throw new DomainError('BAD_STATUS','Il faut confirmer le lancement avant de terminer la PP.');
    transitionSession(session,STATUS.COMPLETED);announcement='complete';
  } else throw new DomainError('BAD_ACTION','Action de menu inconnue.');
  await store.set(session);
  if(selected==='queue_open')scheduleQueue(i.client,store,config,session);
  else cancelTimer(session.id);
  await i.update(i.message?.flags?.has(MessageFlags.IsComponentsV2)?panelView(session,config):sessionView(session,config));
  await refreshSessionMessage(i.client,session,config);
  if(announcement)await postAnnouncement(i.client,session,config,announcement);
}
async function modal(i,store,config) {
  requireGuild(i);
  const [,action,id]=i.customId.split(':');
  if(action!=='code_modal')throw new DomainError('BAD_ACTION','Formulaire inconnu.');
  const session=getSession(i,store,id);
  if(!canHost(i,session,config))throw new DomainError('FORBIDDEN','Seul l’hôte Fortnite peut modifier le code.');
  if(TERMINAL_STATUSES.has(session.status))throw new DomainError('TERMINAL','Cette PP est clôturée.');
  session.code=normalizeCode(i.fields.getTextInputValue('match_code'));
  session.updatedAt=Date.now();
  await store.set(session);
  await refreshSessionMessage(i.client,session,config);
  await i.reply({embeds:[feedbackView('🔐 Code enregistré','Le code a été enregistré. Il reste masqué si la PP est privée.',config)],flags:EPHEMERAL});
}
export async function registerCommands(config,rest=new REST({version:'10'}).setToken(config.token)) {
  const route=config.guildId?Routes.applicationGuildCommands(config.clientId,config.guildId):Routes.applicationCommands(config.clientId);
  await rest.put(route,{body:[buildCommand().toJSON()]});
}
export async function startBot() {
  const config=getConfig();
  if(!config.token||!config.clientId)throw new Error('DISCORD_TOKEN et DISCORD_CLIENT_ID obligatoires.');
  const store=await new JsonStore(config.dataFile).load();
  await registerCommands(config);
  const client=new Client({intents:[GatewayIntentBits.Guilds]});
  client.on('interactionCreate',async i=>{
    try {
      if(i.isAutocomplete()&&i.commandName==='pp') {
        const query=String(i.options.getFocused()||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const filtered=MODE_OPTIONS.filter(item=>item.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
        await i.respond(filtered.slice(0,25));return;
      }
      if(i.isChatInputCommand()&&i.commandName==='pp')await command(i,store,config);
      else if(i.isButton()&&i.customId.startsWith('pp:'))await button(i,store,config);
      else if(i.isStringSelectMenu()&&i.customId.startsWith('pp:'))await menu(i,store,config);
      else if(i.isModalSubmit()&&i.customId.startsWith('pp:'))await modal(i,store,config);
    } catch(error) {
      const expected=error instanceof DomainError;
      if(!expected)console.error('[interaction]',error);
      if(i.isRepliable()) await safeReply(i,{embeds:[feedbackView(expected?'Action impossible':'Erreur interne',expected?error.message:'Réessaie plus tard.',config,'danger')],flags:EPHEMERAL}).catch(()=>{});
    }
  });
  client.once(Events.ClientReady,()=>{
    for(const session of store.values())scheduleQueue(client,store,config,session);
    console.log(`[ready] ${client.user.tag} · ${store.values().length} PP · hôte configuré : ${config.creatorDiscordId?'oui':'non'}`);
  });
  client.on('error',e=>console.error('[discord]',e));
  await client.login(config.token);
  return {client,store};
}