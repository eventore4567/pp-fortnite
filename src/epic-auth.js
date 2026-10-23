import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pending = new Map();
const TTL_MS = 10 * 60_000;
const EPIC_AUTHORIZE = 'https://www.epicgames.com/id/authorize';
const EPIC_TOKEN = 'https://api.epicgames.dev/epic/oauth/v2/token';
const DEFAULT_URL = 'https://pp-fortnite-production.up.railway.app';

function settings() {
  const publicUrl = (process.env.PP_PUBLIC_URL || DEFAULT_URL).replace(/\/$/, '');
  const parsed = new URL(publicUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error('PP_PUBLIC_URL doit être une adresse HTTPS publique.');
  return {
    publicUrl,
    redirectUri: publicUrl + '/auth/epic/callback',
    clientId: process.env.EPIC_CLIENT_ID || '',
    clientSecret: process.env.EPIC_CLIENT_SECRET || '',
    deploymentId: process.env.EPIC_DEPLOYMENT_ID || '',
    linkFile: process.env.EPIC_LINK_FILE || path.join(path.dirname(process.env.DATA_FILE || './data/sessions.json'), 'epic-link.json'),
  };
}

/** Lien autorisé seulement depuis une interaction privée du compte Discord configuré. */
export function createEpicAuthorizationUrl(discordUserId) {
  const config = settings();
  if (!/^\d{17,20}$/.test(discordUserId || '')) throw new Error('Utilisateur Discord invalide.');
  if (!config.clientId || !config.clientSecret)
    throw new Error('Ajoute EPIC_CLIENT_ID et EPIC_CLIENT_SECRET aux variables Railway.');
  for (const [key, value] of pending) if (value.expiresAt < Date.now()) pending.delete(key);
  const state = randomBytes(32).toString('hex');
  pending.set(state, { discordUserId, expiresAt: Date.now() + TTL_MS });
  const url = new URL(EPIC_AUTHORIZE);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'basic_profile');
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeAuthorizationCode(code, config) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    scope: 'basic_profile',
  });
  if (config.deploymentId) body.set('deployment_id', config.deploymentId);
  const credentials = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');
  const response = await fetch(EPIC_TOKEN, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + credentials,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Epic a refusé la connexion OAuth (HTTP ' + response.status + ').');
  const tokenData = await response.json();
  // Ne sauvegarder ni access_token ni refresh_token.
  if (!/^[a-fA-F0-9]{32}$/.test(tokenData.account_id || ''))
    throw new Error('Identifiant Epic absent ou invalide dans la réponse OAuth.');
  return tokenData.account_id.toLowerCase();
}

async function persistLink(discordUserId, epicAccountId, file) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomBytes(6).toString('hex') + '.tmp';
  await writeFile(temporary, JSON.stringify({
    version: 1, discordUserId, epicAccountId, connectedAt: new Date().toISOString()
  }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, file);
}

const HEADER = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const PAGE_STYLE = 'body{background:#11131a;color:#eef0ff;font-family:system-ui,sans-serif;max-width:700px;margin:8vh auto;padding:24px;line-height:1.65}h1{color:#b4a8ff}a{color:#c5bcff}main{padding:20px;border:1px solid #353449;border-radius:16px;background:#1a1c26}';
function html(title, content) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' · PP Fortnite</title><style>' + PAGE_STYLE + '</style></head><body><main><h1>' + title + '</h1>' + content + '</main></body></html>';
}
function respond(res, status, title, content) {
  res.writeHead(status, HEADER);
  res.end(html(title, content));
}
async function callback(req, res, params, client) {
  const state = params.get('state');
  const entry = typeof state === 'string' ? pending.get(state) : null;
  if (state) pending.delete(state);
  if (!entry || entry.expiresAt <= Date.now()) {
    respond(res, 400, 'Connexion expirée', '<p>Relance « Connecter Epic » depuis Discord. Le lien est valable 10 minutes et ne fonctionne qu’une fois.</p>');
    return;
  }
  if (params.has('error')) {
    respond(res, 400, 'Connexion refusée', '<p>L’autorisation a été refusée ou annulée. Tu peux recommencer depuis Discord.</p>');
    return;
  }
  const code = params.get('code');
  if (!code || code.length > 4096) {
    respond(res, 400, 'Code invalide', '<p>Le code d’autorisation Epic est absent.</p>');
    return;
  }
  try {
    const config = settings();
    if (!config.clientId || !config.clientSecret) throw new Error('Configuration OAuth absente.');
    const epicAccountId = await exchangeAuthorizationCode(code, config);
    await persistLink(entry.discordUserId, epicAccountId, config.linkFile);
    respond(res, 200, '✅ Compte Epic connecté', '<p>Ton identité Epic Games a été associée au compte Discord autorisé.</p><p>Tu peux retourner sur Discord. Cette connexion ne permet pas de lancer automatiquement des parties Fortnite.</p>');
    client?.users?.fetch(entry.discordUserId).then(user =>
      user.send('✅ Ton compte Epic Games a été associé à PP Fortnite. Cela permet uniquement de vérifier ton identité Epic, pas de lancer Fortnite automatiquement.').catch(() => {})
    ).catch(() => {});
  } catch (err) {
    console.error('[epic-oauth]', err.message);
    respond(res, 502, 'Connexion impossible', '<p>La connexion Epic a échoué. Vérifie le Client ID, le Client Secret, le Deployment ID et l’URL de redirection dans le portail Epic.</p>');
  }
}

/** Serveur HTTPS public fourni par le proxy Railway, Node écoute le port interne. */
export async function startEpicServer(client) {
  const config = settings();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalide.');
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' || (req.url || '').length > 6000) {
        respond(res, 405, 'Méthode non autorisée', '<p>Utilise le navigateur pour ouvrir une page.</p>'); return;
      }
      const url = new URL(req.url, config.publicUrl);
      if (url.pathname === '/healthz') {
        res.writeHead(200, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}); res.end('ok'); return;
      }
      if (url.pathname === '/') {
        respond(res, 200, 'PP Fortnite', '<p>Bot Discord indépendant pour organiser des parties personnalisées Fortnite : inscriptions, demandes, annonces, files d’attente et statuts.</p><p><strong>Connexion Epic :</strong> ouvre le panneau PP Fortnite dans Discord, puis sélectionne « Connecter Epic Games » en étant connecté au compte Discord de Minimoys.</p><p>Service non officiel et non affilié à Epic Games.</p><p><a href="/privacy">Politique de confidentialité</a></p>'); return;
      }
      if (url.pathname === '/privacy') {
        respond(res, 200, 'Confidentialité', '<p>PP Fortnite conserve les identifiants Discord nécessaires à la gestion des parties et, après consentement OAuth, l’identifiant du compte Epic Games relié. Le code d’autorisation Epic n’est utilisé qu’une seule fois. Les jetons d’accès et de renouvellement Epic ne sont pas conservés.</p><p>Les données servent uniquement au fonctionnement de ce bot Discord. Elles ne sont pas vendues à des annonceurs.</p><p>Pour demander la suppression de la liaison, contacte les administrateurs du serveur Discord qui héberge PP Fortnite.</p><p><a href="/">Retour</a></p>'); return;
      }
      if (url.pathname === '/auth/epic/callback') { await callback(req, res, url.searchParams, client); return; }
      respond(res, 404, 'Page introuvable', '<p>Vérifie l’adresse utilisée.</p>');
    } catch (error) {
      console.error('[web]', error.message);
      if (!res.headersSent) respond(res, 500, 'Erreur interne', '<p>Réessaie dans un instant.</p>');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve); });
  console.log('[web] Serveur OAuth disponible sur le port ' + port + ' (callback ' + config.redirectUri + ')');
  return server;
}
