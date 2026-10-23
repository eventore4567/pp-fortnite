import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, StringSelectMenuBuilder, TextDisplayBuilder } from 'discord.js';
import { BANNER_PNG } from './banner.js';
import { CATEGORIES, STATUS, TERMINAL_STATUSES } from './config.js';

const COLOR={base:0x7564cd,open:0x4cbb87,ready:0xc79a56,live:0x7162cf,done:0x667085,error:0xe05a71};
const EMOJI_RE=/^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/;
const STATES={
  [STATUS.REQUESTED]:{label:'DEMANDE REÇUE',desc:'En attente de validation par l’hôte',emoji:'📨',color:COLOR.base},
  [STATUS.OPEN]:{label:'FILE OUVERTE',desc:'Les joueurs peuvent s’inscrire',emoji:'🟢',color:COLOR.open},
  [STATUS.READY]:{label:'FILE FERMÉE',desc:'En attente du lancement Fortnite',emoji:'⏳',color:COLOR.ready},
  [STATUS.RUNNING]:{label:'PARTIE LANCÉE',desc:'Lancement confirmé manuellement par l’hôte',emoji:'✅',color:COLOR.live},
  [STATUS.COMPLETED]:{label:'PARTIE TERMINÉE',desc:'Session clôturée',emoji:'🏁',color:COLOR.done},
  [STATUS.CANCELLED]:{label:'ANNULÉE',desc:'Demande annulée',emoji:'❌',color:COLOR.error}
};
function icon(config,key,fallback) {
  const value=config?.emojis?.[key];
  return value&&EMOJI_RE.test(value)?value:fallback;
}
function embed(config,color=COLOR.base) {
  return new EmbedBuilder().setColor(color).setAuthor({name:'✦  PP FORTNITE   •   MATCH CENTER'})
    .setFooter({text:'PP Fortnite  •  Match Center  •  Gestion Discord'});
}
export function withBanner(messageEmbed,config) {
  if(config?.bannerUrl) {
    messageEmbed.setImage(config.bannerUrl);
    return {embeds:[messageEmbed],allowedMentions:{parse:[]}};
  }
  messageEmbed.setImage('attachment://pp-banner.png');
  return {
    embeds:[messageEmbed],attachments:[],
    files:[new AttachmentBuilder(BANNER_PNG,{name:'pp-banner.png',description:'Bannière PP Fortnite ultra-fine'})],
    allowedMentions:{parse:[]}
  };
}
function queueLabel(session) {
  if(session.status===STATUS.OPEN&&session.queueEndsAt)
    return `**<t:${Math.floor(session.queueEndsAt/1000)}:R>** · fin <t:${Math.floor(session.queueEndsAt/1000)}:t>`;
  if(session.status===STATUS.REQUESTED)return `**${session.durationMinutes||2} min** après ouverture par l’hôte`;
  if(session.status===STATUS.OPEN)return 'Ouverte par l’hôte';
  return 'Fermée';
}
export function sessionView(session,config={}) {
  const category=CATEGORIES[session.category]||{label:session.category,emoji:'🎮'};
  const state=STATES[session.status]||STATES[STATUS.REQUESTED];
  const closed=TERMINAL_STATUSES.has(session.status);
  const host=session.hostId||session.ownerId;
  const codeLabel=!session.code?'⏳ **En attente de l’hôte**':session.privateCode?'🔒 **Privé** · réservé aux gestionnaires':`🔑 ${session.code}`;
  const card=embed(config,state.color)
    .setTitle(`${state.emoji}  ${state.label}`)
    .setDescription(`**${state.desc}**\n\n> Demandée par <@${session.ownerId}>\n\n**${category.emoji}  ${category.label}  ·  ${session.mode}**`)
    .addFields(
      {name:'👑  HÔTE FORTNITE',value:`<@${host}>`,inline:true},
      {name:'🌍  RÉGION',value:session.region||'Europe',inline:true},
      {name:'👥  INSCRITS',value:`${session.players?.length||0} / ${config.maxPlayers||100}`,inline:true},
      {name:'⏱️  FILE D’ATTENTE',value:queueLabel(session),inline:true},
      {name:'🔑  CODE',value:codeLabel,inline:true},
      {name:'🆔  PARTIE',value:`${session.id}`,inline:true},
    )
    .setTimestamp(session.updatedAt);
  const buttons=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pp:join:${session.id}`).setLabel('Participer / quitter').setStyle(ButtonStyle.Primary).setEmoji(icon(config,'join','🎮')).setDisabled(session.status!==STATUS.OPEN),
    new ButtonBuilder().setCustomId(`pp:roster:${session.id}`).setLabel('Participants').setStyle(ButtonStyle.Secondary).setEmoji(icon(config,'players','👥'))
  );
  const manager=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(`pp:manage:${session.id}`).setPlaceholder('⚙️  Gestion de la PP').setDisabled(closed)
    .addOptions(
      {label:'Ouvrir la file',description:'Démarrer le délai et autoriser les participants',value:'queue_open',emoji:'🟢'},
      {label:'Fermer la file',description:'Stopper les inscriptions',value:'queue_close',emoji:'⏳'},
      {label:'Confirmer : partie lancée',description:'L’hôte a démarré la PP dans Fortnite',value:'launch',emoji:'✅'},
      {label:'Terminer la partie',description:'Clôturer la session',value:'complete',emoji:'🏁'},
      {label:'Voir le code privé',description:'Réponse visible uniquement par toi',value:'reveal_code',emoji:'🔑'},
      {label:'Définir / modifier le code',description:'Réservé à l’hôte Fortnite',value:'set_code',emoji:'✏️'},
      {label:'Publier une annonce',description:'Rappel dans ce salon',value:'announce',emoji:'📣'},
      {label:'Annuler cette PP',description:'Fermer la demande',value:'cancel',emoji:'❌'}
    ));
  return {...withBanner(card,config),components:[buttons,manager]};
}
export function announcementView(session,config={},kind='reminder') {
  const category=CATEGORIES[session.category]||{label:session.category,emoji:'🎮'};
  const titles={queue:'🟢  File d’attente ouverte !',closed:'⏳  File d’attente terminée',launch:'✅  Partie lancée !',complete:'🏁  Partie terminée',cancel:'❌  PP annulée',reminder:'📣  PP Fortnite disponible'};
  const descriptions={queue:'La file est ouverte. Rejoins la PP depuis le panneau ci-dessus.',closed:'Le délai est écoulé. L’hôte peut maintenant lancer la partie.',launch:'Bon jeu à tous ! 🎉\nL’hôte a confirmé le lancement dans Fortnite.',complete:'Merci à tous pour votre participation.',cancel:'Cette partie personnalisée a été annulée.',reminder:'Une partie personnalisée est en préparation. Consulte le panneau de la session.'};
  return embed(config,kind==='launch'?COLOR.open:COLOR.base)
    .setTitle(titles[kind]||titles.reminder)
    .setDescription(`${descriptions[kind]||descriptions.reminder}\n\n**${category.emoji}  ${category.label}  ·  ${session.mode}**`)
    .addFields(
      {name:'👑  HÔTE',value:`<@${session.hostId||session.ownerId}>`,inline:true},
      {name:'⏱️  FILE',value:`${session.durationMinutes||2} minute(s)`,inline:true},
      {name:'🆔  PP',value:session.id,inline:true}
    ).setTimestamp();
}
export function listView(sessions,config={}) {
  const lines=sessions.slice(0,25).map(s=>{
    const c=CATEGORIES[s.category]||{emoji:'🎮',label:s.category};
    const state=STATES[s.status]||STATES[STATUS.REQUESTED];
    return `${state.emoji}  **${c.label} · ${s.mode}**\n↳ ${s.id}  •  <@${s.hostId||s.ownerId}>  •  ${state.label}`;
  });
  return embed(config).setTitle('🎮  Parties personnalisées').setDescription(lines.join('\n\n')||'Aucune PP active.').setFooter({text:'Utilise /pp voir pour ouvrir un panneau'});
}
export function rosterView(session,config={}) {
  const players=session.players||[];
  return embed(config).setTitle(`👥  Participants · ${session.id}`)
    .setDescription(players.length?players.slice(0,100).map((id,i)=>`${String(i+1).padStart(2,'0')}  <@${id}>`).join('\n'):'Aucun participant pour le moment.')
    .addFields({name:'INSCRITS',value:`${players.length} / ${config.maxPlayers||100}`});
}
export function codeView(session,manager,config={}) {
  const code=manager?session.code:(!session.privateCode?session.code:null);
  return embed(config).setTitle('🔐  Code de matchmaking')
    .setDescription(code?`**${code}**\n\nVisible uniquement par toi dans ce message privé. Ce code doit être configuré dans Fortnite par l’hôte.`:'🔒 Code privé ou non défini. Demande-le à l’hôte.')
    .setFooter({text:'Le bot ne peut pas lancer Fortnite automatiquement'});
}
export function launchHelpView(session,config={}) {
  return embed(config).setTitle('🎮  Lancement manuel')
    .setDescription(`L’hôte <@${session.hostId||session.ownerId}> configure la PP dans Fortnite, puis confirme le lancement dans le menu Discord.`);
}
export function feedbackView(title,description,config={},tone='success') {
  return embed(config,tone==='danger'?COLOR.error:tone==='success'?COLOR.open:COLOR.base).setTitle(title).setDescription(description);
}

// Panneaux Discord Components V2 : bannière en premier, sans barre colorée latérale.
// La bande fine est une vraie galerie, pas une image placée sous un embed.
function bannerGallery(config) {
  return new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(config.bannerUrl||'attachment://pp-banner.png')
  );
}
function panelPayload(container,config) {
  const payload={
    flags:MessageFlags.IsComponentsV2,components:[container],
    allowedMentions:{parse:[]},attachments:[]
  };
  if(!config.bannerUrl)payload.files=[new AttachmentBuilder(BANNER_PNG,{name:'pp-banner.png'})];
  return payload;
}
function requesterName(session) {
  return session.requesterName?'@'+session.requesterName:'Demandeur';
}
function hostName(session,config) {
  if(session.hostName)return '@'+session.hostName;
  if(config.creatorDiscordId&&(session.hostId||session.ownerId)===config.creatorDiscordId)return '@Minimoys';
  return 'Hôte';
}
function queueEndLabel(session) {
  if(session.status===STATUS.OPEN&&session.queueEndsAt)
    return `<t:${Math.floor(session.queueEndsAt/1000)}:R>`;
  if(session.status===STATUS.REQUESTED)return `${session.durationMinutes||2} min à l’ouverture`;
  return session.status===STATUS.OPEN?'File ouverte':'File fermée';
}
export function panelView(session,config={}) {
  const category=CATEGORIES[session.category]||{label:session.category,emoji:'🎮'};
  const state=STATES[session.status]||STATES[STATUS.REQUESTED];
  const controls=sessionView(session,config).components;
  const code=!session.code?'À définir par l’hôte':
    session.privateCode?'🔒 Privé':`\`${session.code}\``;
  const container=new ContainerBuilder()
    .addMediaGalleryComponents(bannerGallery(config))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**${state.emoji}  ${state.label}**  ·  ${category.emoji} ${category.label} · ${session.mode}\n-# ${state.desc}  •  Demandée par ${requesterName(session)}`
    ))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**👑 Hôte Fortnite**  ${hostName(session,config)}\n**🌐 Région**  ${session.region||'Europe'}   ·   **⏱️ File**  ${queueEndLabel(session)}\n**🔑 Code**  ${code}   ·   **👥 Inscrits**  ${session.players?.length||0}/${config.maxPlayers||100}\n-# Partie ${session.id} · Lancement validé par l’hôte depuis Discord`
    ))
    .addActionRowComponents(...controls);
  return panelPayload(container,config);
}
export function announcementPanelView(session,config={},kind='reminder') {
  const embedData=announcementView(session,config,kind).toJSON();
  const category=CATEGORIES[session.category]||{label:session.category,emoji:'🎮'};
  const title=embedData.title||'📣  PP Fortnite';
  const msg={
    queue:'Rejoins la file avant la fin du délai.',
    closed:'La file est fermée. L’hôte prépare le lancement.',
    launch:'Bon jeu à tous ! 🎉',
    complete:'Merci pour votre participation.',
    cancel:'La demande est clôturée.',
    reminder:'Une partie personnalisée est disponible.'
  }[kind]||'Une partie personnalisée est disponible.';
  const container=new ContainerBuilder()
    .addMediaGalleryComponents(bannerGallery(config))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### ${title}\n${msg}\n\n**🎯 ${category.label} · ${session.mode}**`
    ))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**👑 Hôte**  ${hostName(session,config)}   ·   **⏱️ Délai**  ${session.durationMinutes||2} min\n-# Demandée par ${requesterName(session)} · Partie ${session.id}`
    ));
  return panelPayload(container,config);
}
