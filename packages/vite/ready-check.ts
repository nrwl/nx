import { waitForViteServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer(
  configPath: string,
  command: 'serve' | 'preview'
) {
  await waitForViteServer(configPath, command);
  // Config hooks can leave handles open, such as vite-plugin-checker's workers
  process.exit(0);
}
