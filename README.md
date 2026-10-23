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

Toutes les autres fonctions passent par les boutons et le menu déroulant : participation, participants, code privé, définition du code, ouverture/fermeture de file, lancement confirmé manuellement, annonces, annulation et connexion Epic du compte créateur.

## Connexion Epic Games — identité uniquement

Une connexion Epic Account Services (OAuth 2.0, permission `basic_profile`) est disponible depuis le menu de gestion des PP. **Seul le compte Discord configuré dans `PP_CREATOR_DISCORD_ID` peut initier cette connexion**. Le lien s'affiche de manière éphémère dans Discord, expire en 10 minutes et est protégé contre les retours OAuth non sollicités par un état aléatoire. Après confirmation par Epic, le bot enregistre uniquement l'identifiant Epic associé dans `EPIC_LINK_FILE` sur le volume Railway ; aucun access token ni refresh token n'est conservé.

Domaine HTTPS gratuit de test : `https://pp-fortnite-production.up.railway.app`
URL de retour à configurer **à l'identique** dans le client Epic : `https://pp-fortnite-production.up.railway.app/auth/epic/callback`

Configuration sur Railway : `PP_PUBLIC_URL`, `PORT=3000`, `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, et éventuellement `EPIC_DEPLOYMENT_ID`. **Le Client Secret doit rester une variable privée Railway, jamais un message Discord, un commit GitHub ou une capture.**

Pour un produit Epic non vérifié, seuls les comptes membres de son organisation peuvent se connecter en test. Pour soumettre une marque à validation publique, Epic exige notamment un domaine dont l'organisation prouve la propriété ; le sous-domaine gratuit Railway ne remplace pas cette vérification.

**Cette liaison est uniquement une vérification d'identité.** Elle ne crée pas de lobby, ne configure pas les modes Fortnite et ne lance pas la partie depuis Xbox. L'hôte doit toujours lancer le matchmaking dans Fortnite lui-même.


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

Le fichier `railway.json` utilise le `Dockerfile` vérifié du dépôt, configure `npm start` et le redémarrage sur échec. Cette construction explicite évite de dépendre de la détection automatique du builder Railway.

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

## Site web gratuit

Le même processus Node.js expose un petit site sur `PORT` (port 3000 par défaut), les routes `/`, `/privacy`, `/healthz` et `/auth/epic/callback`. Configure un domaine Railway dont le port cible est **3000**. L'URL de redirection exacte doit correspondre à celle du client Epic OAuth.
