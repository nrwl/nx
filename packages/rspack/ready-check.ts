import { waitForRspackDevServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer(configPath: string) {
  await waitForRspackDevServer(configPath);
  // A config can leave handles open that would keep the check running
  process.exit(0);
}
