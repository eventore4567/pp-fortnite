# PP Fortnite — Discord bot

Bot autonome de gestion de parties personnalisées Fortnite, au style premium inspiré de SentriX, sans dépendance à SentriX.

## Installation

1. Crée une application Discord et un bot sur le Developer Portal.
2. Invite-le avec les scopes `bot` et `applications.commands`, et les permissions d'envoyer des messages et d'utiliser des commandes.
3. Installe Node.js 20+, puis `npm install`.
4. Copie `.env.example` vers `.env`, remplis `DISCORD_TOKEN` et `DISCORD_CLIENT_ID`.
5. Lance `npm start`. Les slash commands sont enregistrées globalement (la propagation peut prendre du temps).

## Commandes

- `/pp creer` : catégorie, mode, région, code optionnel, confidentialité.
- `/pp liste` : sessions actives.
- `/pp voir` : afficher une session.
- `/pp annuler` : annuler une session.

Boutons : rejoindre/quitter, préparer, lancer manuellement (instruction uniquement), annuler. Seul l'hôte ou un membre avec Manage Server peut gérer la session. Les données sont sauvegardées dans `sessions.json` : prévoir un volume persistant en hébergement.

## Important : intégration Fortnite

Le bot **ne se connecte pas à Epic Games**, ne crée pas de code de matchmaking reconnu par Fortnite, ne détecte pas le lobby et ne lance pas réellement les parties. Les codes sont des références préparatoires à utiliser uniquement si un hôte autorisé les configure lui-même dans Fortnite. Ne communique jamais de mot de passe Epic au bot. L'intégration officielle et ses permissions devront être étudiées séparément.

## Hébergement Railway

Service Node.js depuis ce dépôt, commande de démarrage `npm start`, variables `DISCORD_TOKEN` et `DISCORD_CLIENT_ID`. Monte un volume persistant pour la sauvegarde, ou remplace la sauvegarde JSON par PostgreSQL avant une utilisation à grande échelle.
