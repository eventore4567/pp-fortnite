import 'dotenv/config';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const TOKEN=process.env.DISCORD_TOKEN, CLIENT_ID=process.env.DISCORD_CLIENT_ID;
if(!TOKEN||!CLIENT_ID) throw Error('Configure DISCORD_TOKEN and DISCORD_CLIENT_ID');
const FILE='./sessions.json';
let db={sessions:{},settings:{}};
try { db=JSON.parse(await readFile(FILE,'utf8')); } catch {}
db.sessions??={}; db.settings??={};
const save=()=>writeFile(FILE,JSON.stringify(db,null,2));
const modes={br:['Solo','Duo','Trio','Section'],og:['Solo','Duo','Section'],reload:['Duo','Section'],blitz:['Solo','Duo','Section']};
const labels={br:'Battle Royale',og:'Fortnite OG',reload:'Recharge',blitz:'Blitz'};
const regions=['Europe','NA-East','NA-West','NA-Central','Brazil','Asia','Oceania','Middle East'];
const command=new SlashCommandBuilder().setName('pp').setDescription('Gestion des parties personnalisées')
.addSubcommand(s=>s.setName('creer').setDescription('Préparer une PP').addStringOption(o=>o.setName('categorie').setDescription('Type de partie').setRequired(true).addChoices(...Object.entries(labels).map(([value,name])=>({name,value})))).addStringOption(o=>o.setName('mode').setDescription('Format').setRequired(true).addChoices(...['Solo','Duo','Trio','Section'].map(x=>({name:x,value:x})))).addStringOption(o=>o.setName('region').setDescription('Région').setRequired(true).addChoices(...regions.map(x=>({name:x,value:x})))).addStringOption(o=>o.setName('code').setDescription('Code souhaité (sinon aléatoire)').setMaxLength(16)).addBooleanOption(o=>o.setName('privee').setDescription('Ne pas afficher le code publiquement')))
.addSubcommand(s=>s.setName('voir').setDescription('Afficher une PP').addStringOption(o=>o.setName('id').setDescription('Identifiant de session').setRequired(true)))
.addSubcommand(s=>s.setName('annuler').setDescription('Annuler une PP').addStringOption(o=>o.setName('id').setDescription('Identifiant de session').setRequired(true)))
.addSubcommand(s=>s.setName('liste').setDescription('Lister les PP actives'));
await new REST({version:'10'}).put(Routes.applicationCommands(CLIENT_ID),{body:[command.toJSON()]});
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const canManage=(i,s)=>i.user.id===s.owner||i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
const esc=x=>String(x).replace(/[@`*_~|>]/g,'').slice(0,60);
const render=s=>{
 const e=new EmbedBuilder().setColor(s.status==='annulee'?0x666b75:0x5865f2).setTitle('✦  FORTNITE  /  PRIVATE MATCH').setDescription('**'+labels[s.category]+'**  •  '+s.mode+'\n\n'+(s.status==='ouverte'?'🟢  Inscriptions ouvertes':s.status==='prete'?'🟠  Prête — lancement manuel':'🔴  Session annulée')).addFields(
 {name:'🌍 Région',value:s.region,inline:true},{name:'👑 Hôte',value:'<@'+s.owner+'>',inline:true},
 {name:'🎟️ Code',value:s.private?'🔒 Communiqué par l’hôte':'`'+s.code+'`',inline:true},
 {name:'👥 Participants',value:String(s.players.length),inline:true},
 {name:'🆔 Session',value:'`'+s.id+'`',inline:true}
 ).setFooter({text:'PP Fortnite • Gestion Discord uniquement • Connexion Epic non active'});
 const disabled=s.status==='annulee';
 const row=new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId('join:'+s.id).setLabel('Rejoindre / Quitter').setEmoji('🎮').setStyle(ButtonStyle.Primary).setDisabled(disabled),
 new ButtonBuilder().setCustomId('ready:'+s.id).setLabel('Préparer').setEmoji('⏳').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
 new ButtonBuilder().setCustomId('launch:'+s.id).setLabel('Lancer (manuel)').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(disabled),
 new ButtonBuilder().setCustomId('cancel:'+s.id).setLabel('Annuler').setEmoji('✖️').setStyle(ButtonStyle.Danger).setDisabled(disabled));
 return {embeds:[e],components:[row]};
};
client.on('interactionCreate',async i=>{
 try {
 if(i.isChatInputCommand()){
  const sub=i.options.getSubcommand();
  if(sub==='creer'){
   const category=i.options.getString('categorie'),mode=i.options.getString('mode'),region=i.options.getString('region');
   if(!modes[category].includes(mode)) return i.reply({content:'Ce mode n’est pas disponible pour cette catégorie.',flags:MessageFlags.Ephemeral});
   const custom=i.options.getString('code');
   if(custom&&!/^[A-Za-z0-9_-]{4,16}$/.test(custom)) return i.reply({content:'Le code doit contenir 4 à 16 lettres, chiffres, _ ou -.',flags:MessageFlags.Ephemeral});
   const id=randomBytes(4).toString('hex').toUpperCase();
   const s={id,guild:i.guildId,owner:i.user.id,category,mode,region,code:custom||randomBytes(4).toString('hex').toUpperCase(),private:i.options.getBoolean('privee')??false,players:[],status:'ouverte',created:Date.now()};
   db.sessions[id]=s;await save();
   return i.reply(render(s));
  }
  if(sub==='liste'){
   const active=Object.values(db.sessions).filter(s=>s.guild===i.guildId&&s.status!=='annulee').slice(-20);
   return i.reply({content:active.length?active.map(s=>'`'+s.id+'` • '+labels[s.category]+' '+s.mode+' • '+s.status).join('\n'):'Aucune session active.',flags:MessageFlags.Ephemeral});
  }
  const id=i.options.getString('id').toUpperCase(),s=db.sessions[id];
  if(!s||s.guild!==i.guildId)return i.reply({content:'Session introuvable.',flags:MessageFlags.Ephemeral});
  if(sub==='voir')return i.reply(render(s));
  if(!canManage(i,s))return i.reply({content:'Seul l’hôte ou un gestionnaire peut annuler.',flags:MessageFlags.Ephemeral});
  s.status='annulee';await save();return i.reply(render(s));
 }
 if(i.isButton()){
  const [action,id]=i.customId.split(':'),s=db.sessions[id];
  if(!s||s.guild!==i.guildId)return i.reply({content:'Session introuvable.',flags:MessageFlags.Ephemeral});
  if(s.status==='annulee')return i.reply({content:'Session annulée.',flags:MessageFlags.Ephemeral});
  if(action==='join'){
   const idx=s.players.indexOf(i.user.id);
   if(idx>=0)s.players.splice(idx,1);else s.players.push(i.user.id);
  }else{
   if(!canManage(i,s))return i.reply({content:'Action réservée à l’hôte.',flags:MessageFlags.Ephemeral});
   if(action==='ready')s.status='prete';
   if(action==='cancel')s.status='annulee';
   if(action==='launch'){
    return i.reply({content:'⚠️ Le contrôle Fortnite n’est pas connecté. Lance la PP manuellement dans Fortnite avec ton compte autorisé. Le bouton ne lance pas la partie dans le jeu.',flags:MessageFlags.Ephemeral});
   }
  }
  await save();return i.update(render(s));
 }
 }catch(err){console.error(err);if(i.isRepliable()){const payload={content:'Une erreur est survenue. Réessaie.',flags:MessageFlags.Ephemeral};if(i.replied||i.deferred)await i.followUp(payload).catch(()=>{});else await i.reply(payload).catch(()=>{});}}
});
client.once('ready',()=>console.log('PP Fortnite connecté : '+client.user.tag));
await client.login(TOKEN);
