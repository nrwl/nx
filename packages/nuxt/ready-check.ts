import { waitForNuxtDevServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer() {
  await waitForNuxtDevServer();
  // A config can leave handles open that would keep the check running
  process.exit(0);
}
