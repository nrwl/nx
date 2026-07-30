import { loadConfigFile } from '@nx/devkit/internal';
import type { PlaywrightTestConfig } from '@playwright/test';
import { join } from 'node:path';
import {
  normalizeWebServers,
  type ResolvedWebServer,
} from './webserver-readiness';

/**
 * Forked child that evaluates a Playwright config under the env it was spawned
 * with (see resolveWebServersUnderEnv) and returns the resolved `webServer`
 * addresses. A child is used rather than an in-process re-evaluation because
 * createNodes evaluates configs concurrently: a shared `process.env` swap would
 * race across them, and the module cache would hand back the first evaluation.
 *
 * argv: [configFilePath (workspace-relative), workspaceRoot]. The result is
 * sent over the IPC channel as ResolvedWebServer[], or `{ error }` on failure.
 */
async function main(): Promise<void> {
  const [configFilePath, workspaceRoot] = process.argv.slice(2);
  const config = await loadConfigFile<PlaywrightTestConfig>(
    join(workspaceRoot, configFilePath)
  );
  await send(normalizeWebServers(config.webServer));
}

// process.exit can truncate an IPC message that has not been flushed to the
// parent, so wait for the send to be acknowledged before exiting. A delivery
// failure rejects so the caller exits nonzero rather than reporting success.
function send(message: ResolvedWebServer[] | { error: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      resolve();
      return;
    }
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

main().then(
  () => process.exit(0),
  async (error) => {
    // A non-empty message so the failure the parent surfaces stays diagnosable.
    const detail =
      (error && (error.stack || error.message)) ||
      String(error) ||
      'Unknown error while evaluating the Playwright config.';
    try {
      await send({ error: detail });
    } catch {
      // The channel is gone; the nonzero exit below still signals the failure.
    }
    process.exit(1);
  }
);
