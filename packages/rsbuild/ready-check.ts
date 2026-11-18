import { waitForRsbuildServer } from './src/utils/dev-server-ready-check';

export async function waitForDevServer(
  configPath: string,
  command: 'dev' | 'preview'
) {
  await waitForRsbuildServer(configPath, command);
  // The config or its plugins can leave handles open
  process.exit(0);
}
