import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { workspaceRoot } from './workspace-root';
import { join } from 'path';

/**
 * This loads dotenv files from:
 * - .env
 * - .local.env
 * - .env.local
 */
export function loadRootEnvFiles(root = workspaceRoot) {
  for (const file of ['.local.env', '.env.local', '.env']) {
    const myEnv = loadDotEnvFile({
      path: join(root, file),
    });
    expand(myEnv);
  }
}
