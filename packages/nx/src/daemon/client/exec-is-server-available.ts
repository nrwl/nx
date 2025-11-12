import { daemonClient } from './client.js';

(async () => {
  try {
    console.log(await daemonClient.isServerAvailable());
  } catch {
    console.log(false);
  }
})();
