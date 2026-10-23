# PP Fortnite — bot Discord

Bot autonome de gestion de parties personnalisées Fortnite. Son interface premium reprend une esthétique sombre, nette et structurée inspirée de SentriX, mais le projet ne dépend pas de SentriX et ne le modifie pas.

## Ce que le bot gère

- Catégories Battle Royale, Fortnite OG, Recharge et Blitz, avec validation des modes compatibles.
- Création, liste, consultation, annulation, inscriptions, participants et annonces.
- États `ouverte`, `prete`, `en_cours`, `terminee` et `annulee`.
- Codes publics ou privés, avec accès privé limité à l’hôte et aux gestionnaires.
- Permissions de gestion pour l’hôte, `Gérer le serveur` et `Gérer les évènements`.
- Stockage JSON persistant, écrit de manière atomique pour limiter les corruptions.
- Limite de joueurs, délai anti-spam pour les annonces et mentions neutralisées.
- Interface premium cohérente sur les panneaux, listes, participants, annonces, confirmations et erreurs.
- Emojis personnalisés facultatifs avec retour automatique vers des emojis Unicode compatibles.

## Les quatre seules sous-commandes

- `/pp creer` — crée le panneau interactif.
- `/pp liste` — liste les sessions actives.
- `/pp voir` — affiche une session à partir de son identifiant.
- `/pp annuler` — annule une session avec contrôle des permissions.

Toutes les autres fonctions passent par les boutons et le menu déroulant du panneau : rejoindre/quitter, participants, affichage du code, instructions de lancement, ouverture/fermeture des inscriptions, état en cours/terminé, annonce et annulation.

## Limite Fortnite/Epic explicite

Ce bot **ne se connecte pas à Epic Games**. Il ne crée pas de code de matchmaking Epic valide, ne détecte pas un lobby et ne lance pas une partie réelle. Un code enregistré ici est une **référence préparatoire** : un créateur autorisé doit configurer et lancer la partie manuellement dans Fortnite. Ne transmettez jamais d’identifiants, de mot de passe ou de code 2FA Epic au bot.

## Installation locale

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
cp .env.example .env
npm test
npm start
```

Variables obligatoires :

- `DISCORD_TOKEN` : jeton du bot Discord.
- `DISCORD_CLIENT_ID` : identifiant de l’application Discord.

Variables facultatives :

- `DISCORD_GUILD_ID` : enregistre la commande immédiatement dans un serveur de test. Sans cette variable, la commande est globale et sa propagation peut prendre du temps.
- `DATA_FILE` : chemin du fichier persistant, par défaut `./data/sessions.json`.
- `PP_BANNER_URL` : URL HTTPS publique d’une bannière personnalisée.
- `PP_ACCENT_COLOR` : couleur décimale des embeds.
- `PP_MAX_PLAYERS` : limite entre 2 et 100.
- `PP_ANNOUNCE_COOLDOWN_SECONDS` : délai entre annonces, entre 10 et 3600 secondes.
- `PP_EMOJI_*` : emojis Discord personnalisés facultatifs au format `<:nom:identifiant>` (ou `<a:nom:identifiant>`). Clés disponibles : `BRAND`, `JOIN`, `PLAYERS`, `CODE`, `LAUNCH`, `MANAGE`, `OPEN`, `READY`, `RUNNING`, `COMPLETED`, `ANNOUNCE`, `CANCEL`, `REGION`, `HOST`, `SESSION`. Une valeur absente ou invalide utilise automatiquement un emoji Unicode propre.

Invitez l’application avec les scopes `bot` et `applications.commands`. Le bot a besoin de voir le salon, envoyer des messages, intégrer des liens et utiliser des commandes d’application.

## Déploiement Railway

Le fichier `railway.json` configure la construction, `npm start` et le redémarrage sur échec.

1. Créez un service Railway depuis ce dépôt.
2. Ajoutez `DISCORD_TOKEN` et `DISCORD_CLIENT_ID` dans les variables du service. Pour tester les commandes sans délai, ajoutez temporairement `DISCORD_GUILD_ID`.
3. Créez un volume persistant monté sur `/data`.
4. Définissez `DATA_FILE=/data/sessions.json`.
5. Déployez puis vérifiez dans les journaux une ligne commençant par `[ready]`.

Sans volume, les sessions peuvent disparaître lors d’un redéploiement. Pour une charge importante ou plusieurs instances, remplacez le stockage JSON par une base transactionnelle avant de mettre à l’échelle.

## Vérification

```bash
npm test
npm run check
```

Les tests couvrent le catalogue strict des sous-commandes, la matrice catégorie/mode, les codes, les inscriptions, les limites, les transitions d’état, la confidentialité et la persistance. Un test Discord réel nécessite un jeton et un serveur de test ; il n’est pas simulé par la suite locale.
