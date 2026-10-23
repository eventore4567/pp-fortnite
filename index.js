import { startBot } from './src/bot.js';

startBot().catch((error) => {
  console.error('[fatal] Impossible de démarrer PP Fortnite.', error);
  process.exitCode = 1;
});
