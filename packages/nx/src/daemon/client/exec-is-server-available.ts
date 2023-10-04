import { daemonClient } from './client';

(async () => {
  try {
    console.log(await daemonClient.isServerAvailable());
  } catch {
    console.log(false);
  }
})();
