import { waitForExpoDevServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer() {
  await waitForExpoDevServer();
  process.exit(0);
}
