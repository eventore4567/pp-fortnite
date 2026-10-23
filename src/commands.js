import { SlashCommandBuilder } from 'discord.js';
import { CATEGORIES, REGIONS } from './config.js';

export function buildCommand() {
  return new SlashCommandBuilder().setName('pp').setDescription('Gérer les parties personnalisées Fortnite').setDMPermission(false)
    .addSubcommand((s) => s.setName('creer').setDescription('Créer le panneau d’une PP')
      .addStringOption((o) => o.setName('categorie').setDescription('Catégorie').setRequired(true).addChoices(...Object.entries(CATEGORIES).map(([value, item]) => ({ name: item.label, value }))))
      .addStringOption((o) => o.setName('mode').setDescription('Choisis d’abord la catégorie, puis le mode compatible').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('region').setDescription('Région').setRequired(true).addChoices(...REGIONS.map((value) => ({ name: value, value }))))
      .addStringOption((o) => o.setName('code').setDescription('Référence préparatoire, pas un code Epic').setMaxLength(16))
      .addBooleanOption((o) => o.setName('privee').setDescription('Masquer le code aux participants')))
    .addSubcommand((s) => s.setName('liste').setDescription('Lister les PP actives'))
    .addSubcommand((s) => s.setName('voir').setDescription('Afficher une PP').addStringOption((o) => o.setName('id').setDescription('Identifiant de session').setRequired(true).setMinLength(8).setMaxLength(8)))
    .addSubcommand((s) => s.setName('annuler').setDescription('Annuler une PP').addStringOption((o) => o.setName('id').setDescription('Identifiant de session').setRequired(true).setMinLength(8).setMaxLength(8)));
}
