import type { CreateNodes, CreateNodesResult } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const INSTALL_TASK = '@nx/nx-source:playwright-install-e2e';
const PLAYWRIGHT_CALL =
  /\b(?:shouldRunPlaywrightTests|ensurePlaywrightBrowsersInstallation)\(/;

/**
 * Makes each e2e spec that runs Playwright depend on installing the browsers
 * and their system packages up front. The suites install browsers only, and a
 * machine's first install would otherwise run inside a test's timeout.
 * nx.json's targetDefaults keep these `dependsOn` entries only because their
 * `dependsOn` for these targets starts with `'...'`.
 */
export const createNodes: CreateNodes = [
  'e2e/*/**/*.{spec,test}.{ts,tsx,js,jsx}',
  (specFiles, _options, context) => {
    const dependsOn = ['...', INSTALL_TASK];
    const wiredProjects = new Set<string>();
    const results: Array<readonly [string, CreateNodesResult]> = [];
    for (const specFile of specFiles) {
      const source = readFileSync(
        join(context.workspaceRoot, specFile),
        'utf-8'
      );
      if (!PLAYWRIGHT_CALL.test(source)) {
        continue;
      }
      const projectRoot = specFile.split('/').slice(0, 2).join('/');
      const targets: Record<string, { dependsOn: string[] }> = {
        [`e2e-ci--${posix.relative(projectRoot, specFile)}`]: { dependsOn },
      };
      if (!wiredProjects.has(projectRoot)) {
        wiredProjects.add(projectRoot);
        targets['e2e-local'] = { dependsOn };
      }
      results.push([specFile, { projects: { [projectRoot]: { targets } } }]);
    }
    return results;
  },
];
