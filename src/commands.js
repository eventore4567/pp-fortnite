import { SlashCommandBuilder } from 'discord.js';
import { REGIONS } from './config.js';
export function buildCommand() {
  return new SlashCommandBuilder().setName('pp').setDescription('Demandes et gestion des parties personnalisées Fortnite').setDMPermission(false)
    .addSubcommand(s=>s.setName('creer').setDescription('Demander une partie personnalisée Fortnite')
      .addStringOption(o=>o.setName('mode').setDescription('Mode de jeu : Construction, Zéro construction, Solo, Duo…').setRequired(true).setAutocomplete(true))
      .addStringOption(o=>o.setName('code').setDescription('Code Fortnite, ou vide si l’hôte le définit').setMinLength(4).setMaxLength(16))
      .addBooleanOption(o=>o.setName('prive').setDescription('Masquer le code aux membres (oui par défaut)'))
      .addIntegerOption(o=>o.setName('delai').setDescription('Minutes de file : 2 défaut, 3 max (5 avec un rôle autorisé)').setMinValue(1).setMaxValue(5))
      .addStringOption(o=>o.setName('region').setDescription('Région Fortnite (Europe par défaut)').addChoices(...REGIONS.map(v=>({name:v,value:v})))))
    .addSubcommand(s=>s.setName('liste').setDescription('Lister les PP actives'))
    .addSubcommand(s=>s.setName('voir').setDescription('Voir une PP').addStringOption(o=>o.setName('id').setDescription('Identifiant de PP').setRequired(true).setMinLength(8).setMaxLength(8)))
    .addSubcommand(s=>s.setName('annuler').setDescription('Annuler une PP').addStringOption(o=>o.setName('id').setDescription('Identifiant de PP').setRequired(true).setMinLength(8).setMaxLength(8)));
}