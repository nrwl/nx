import { loadConfigFile } from '@nx/devkit/internal';
import type { PlaywrightTestConfig } from '@playwright/test';
import { join } from 'node:path';
import { normalizeWebServers } from './webserver-readiness';

/**
 * Forked child that evaluates a Playwright config under the env it was spawned
 * with (see resolveWebServersUnderEnv) and returns the resolved `webServer`
 * addresses. A child is used rather than an in-process re-evaluation because
 * createNodes evaluates configs concurrently: a shared `process.env` swap would
 * race across them, and the module cache would hand back the first evaluation.
 *
 * argv: [configFilePath (workspace-relative), workspaceRoot]. The result is
 * sent over the IPC channel as ResolvedWebServer[].
 */
async function main(): Promise<void> {
  const [configFilePath, workspaceRoot] = process.argv.slice(2);
  const config = await loadConfigFile<PlaywrightTestConfig>(
    join(workspaceRoot, configFilePath)
  );
  process.send?.(normalizeWebServers(config.webServer));
}

main().then(
  () => process.exit(0),
  (error) => {
    process.send?.({ error: error?.stack ?? String(error) });
    process.exit(1);
  }
);
