// @ts-check
/**
 * Prints the package manager versions build-e2e-base-workspace.mjs builds its
 * templates with. A runtime input of populate-e2e-base-workspace, so a version
 * bump rebuilds the cached templates instead of restoring ones from the old version.
 */
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

// Outside the repo, like the build: corepack resolves a different manager there
// than it does under the root package.json's packageManager field.
const cwd = tmpdir();

for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) {
  let version;
  try {
    version = execSync(`${pm} --version`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    version = 'unavailable';
  }
  console.log(`${pm} ${version}`);
}
