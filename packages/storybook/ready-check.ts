import { waitForStorybookDevServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer() {
  await waitForStorybookDevServer();
  process.exit(0);
}
