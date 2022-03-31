import { isServerAvailable } from './client';

(async () => {
  try {
    console.log(await isServerAvailable());
  } catch {
    console.log(false);
  }
})();
