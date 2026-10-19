import { waitForWebpackDevServer } from './src/utils/dev-server-ready-check';

// The config can leave handles open, such as a type checker's workers
export async function waitForDevServer(configPath: string) {
  await waitForWebpackDevServer(configPath);
  process.exit(0);
}
