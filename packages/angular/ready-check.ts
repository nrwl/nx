import { waitForAngularDevServer } from './src/plugins/utils/dev-server-ready-check';

export async function waitForDevServer(workspaceConfigPath: string) {
  await waitForAngularDevServer(workspaceConfigPath);
  process.exit(0);
}
