import { workspaceRoot } from './workspace-root';
import { join } from 'path';
import { loadAndExpandDotEnvFile } from '../tasks-runner/task-env';

/**
 * This loads dotenv files from:
 * - .env
 * - .local.env
 * - .env.local
 */
export function loadRootEnvFiles(root = workspaceRoot) {
  for (const file of ['.local.env', '.env.local', '.env']) {
    loadAndExpandDotEnvFile(join(root, file), process.env);
  }
}
