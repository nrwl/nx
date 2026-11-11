import type { CreateNodes, CreateNodesResult } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const WORKSPACE_INSTALL_TASK = '@nx/nx-source:playwright-install-e2e';
const WORKSPACE_PLAYWRIGHT_CALL =
  /\b(?:shouldRunPlaywrightTests|ensurePlaywrightBrowsersInstallation)\(/;
// Installs only Chromium's headless shell for the repo's own Playwright.
const REPO_INSTALL_TASK = '@nx/nx-source:playwright-install';
// Matches top-level imports only, because specs also embed Playwright imports
// in the files they write into generated workspaces.
const REPO_PLAYWRIGHT_IMPORT =
  /^import(?!\s+type\s)[^;]*?\sfrom\s+['"](?:@playwright\/test|playwright|playwright-core)['"]/m;

/**
 * Makes each e2e spec that runs Playwright depend on the install for the
 * Playwright version it uses, so no install runs inside a test's timeout.
 * nx.json's targetDefaults keep these `dependsOn` entries only because their
 * `dependsOn` for these targets starts with `'...'`.
 */
export const createNodes: CreateNodes = [
  'e2e/*/**/*.{spec,test}.{ts,tsx,js,jsx}',
  (specFiles, _options, context) => {
    const wiredProjectTasks = new Set<string>();
    const results: Array<readonly [string, CreateNodesResult]> = [];
    for (const specFile of specFiles) {
      const source = readFileSync(
        join(context.workspaceRoot, specFile),
        'utf-8'
      );
      const installTasks: string[] = [];
      if (WORKSPACE_PLAYWRIGHT_CALL.test(source)) {
        installTasks.push(WORKSPACE_INSTALL_TASK);
      }
      if (REPO_PLAYWRIGHT_IMPORT.test(source)) {
        installTasks.push(REPO_INSTALL_TASK);
      }
      if (installTasks.length === 0) {
        continue;
      }
      const projectRoot = specFile.split('/').slice(0, 2).join('/');
      const targets: Record<string, { dependsOn: string[] }> = {
        [`e2e-ci--${posix.relative(projectRoot, specFile)}`]: {
          dependsOn: ['...', ...installTasks],
        },
      };
      // Nx appends the `dependsOn` of every result for the same target, so add
      // each install task to a project's e2e-local once.
      const newE2eLocalTasks = installTasks.filter(
        (task) => !wiredProjectTasks.has(`${projectRoot}|${task}`)
      );
      if (newE2eLocalTasks.length > 0) {
        for (const task of newE2eLocalTasks) {
          wiredProjectTasks.add(`${projectRoot}|${task}`);
        }
        targets['e2e-local'] = { dependsOn: ['...', ...newE2eLocalTasks] };
      }
      results.push([specFile, { projects: { [projectRoot]: { targets } } }]);
    }
    return results;
  },
];
