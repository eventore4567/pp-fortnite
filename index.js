import { startBot } from './src/bot.js';
import { startEpicServer } from './src/epic-auth.js';

startBot().then(async ({client}) => {
  await startEpicServer(client);
}).catch((error) => {
  console.error('[fatal] Impossible de démarrer PP Fortnite.', error);
  process.exitCode = 1;
});
