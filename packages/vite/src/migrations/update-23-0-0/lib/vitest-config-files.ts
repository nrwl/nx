import { visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import picomatch = require('picomatch');

// Vitest options can live in either `vitest.config.*` (dedicated) or
// `vite.config.*` (the `test:` block consumed by the inferred plugin).
const CONFIG_GLOBS = [
  '**/vitest.*config*.{js,ts,mjs,mts,cjs,cts}',
  '**/vite.*config*.{js,ts,mjs,mts,cjs,cts}',
];
const WORKSPACE_GLOB = '**/vitest.workspace.{js,ts,mjs,mts,cjs,cts}';

const configMatchers = CONFIG_GLOBS.map((g) => picomatch(g));
const workspaceMatcher = picomatch(WORKSPACE_GLOB);

export function isVitestConfigFile(filePath: string): boolean {
  return configMatchers.some((m) => m(filePath));
}

export function isVitestWorkspaceFile(filePath: string): boolean {
  return workspaceMatcher(filePath);
}

export function visitVitestConfigFiles(
  tree: Tree,
  callback: (filePath: string) => void
): void {
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (isVitestConfigFile(filePath)) {
      callback(filePath);
    }
  });
}

const TS_JS_RE = /\.[cm]?[jt]sx?$/;
export function isJsOrTsFile(filePath: string): boolean {
  return TS_JS_RE.test(filePath);
}
