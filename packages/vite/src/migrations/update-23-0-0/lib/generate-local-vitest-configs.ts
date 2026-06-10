import { joinPathFragments, type Tree, visitNotIgnoredFiles } from '@nx/devkit';
import {
  isVitestConfigFile,
  isVitestWorkspaceFile,
} from './vitest-config-files';

/**
 * Packages that run vitest through a package.json script but have no local
 * vite/vitest config relied on Vitest 3 running their own test files from the
 * package directory. In Vitest 4 the same invocation climbs up to the root
 * `vitest.config.*`, resolves its `test.projects` globs relative to the
 * package directory, matches nothing, and hard-errors with "No projects were
 * found". A minimal local config stops the climb and lets `@nx/vitest` infer
 * the package's test target. Returns the created file paths.
 */
export function generateLocalVitestConfigs(tree: Tree): string[] {
  const created: string[] = [];

  const packageJsonPaths: string[] = [];
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath === 'package.json' || filePath.endsWith('/package.json')) {
      packageJsonPaths.push(filePath);
    }
  });

  const rootHasTsconfig =
    tree.exists('tsconfig.base.json') || tree.exists('tsconfig.json');
  for (const packageJsonPath of packageJsonPaths) {
    try {
      processPackage(tree, packageJsonPath, rootHasTsconfig, created);
    } catch {
      // Generation is best-effort; a problematic package must not fail the
      // migration.
    }
  }

  return created.sort();
}

function processPackage(
  tree: Tree,
  packageJsonPath: string,
  rootHasTsconfig: boolean,
  created: string[]
): void {
  let packageJson: any;
  try {
    packageJson = JSON.parse(tree.read(packageJsonPath, 'utf-8'));
  } catch {
    return;
  }
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== 'object') return;
  if (
    !Object.values(scripts).some(
      (script) => typeof script === 'string' && scriptInvokesVitest(script)
    )
  ) {
    return;
  }

  const dir = packageJsonPath.includes('/')
    ? packageJsonPath.slice(0, packageJsonPath.lastIndexOf('/'))
    : '.';
  const siblings = tree.children(dir === '.' ? '' : dir);
  if (siblings.some((f) => isVitestConfigFile(f))) return;
  // A directory hosting the workspace file is the projects-mode entry
  // point, both before and after the migration; it needs no local config.
  if (siblings.some((f) => isVitestWorkspaceFile(f))) return;

  const ext =
    rootHasTsconfig || siblings.some((f) => /^tsconfig(\..+)?\.json$/.test(f))
      ? '.ts'
      : '.mjs';
  const configPath = joinPathFragments(dir, `vitest.config${ext}`);
  tree.write(
    configPath,
    `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {},
});
`
  );
  created.push(configPath);
}

/**
 * True when some command in the script runs the `vitest` binary (directly,
 * path-prefixed, or after a runner/env prefix like `npx`/`cross-env A=1`)
 * without pointing it at an explicit config. `npm run vitest` style commands
 * run another script, not the binary, and invocations passing `--config`,
 * `-c`, or `--root` don't rely on config discovery from the cwd, so a
 * generated local config would only get in the way of target inference.
 */
function scriptInvokesVitest(script: string): boolean {
  return script.split(/&&|\|\||;|\|/).some((command) => {
    const tokens = command.trim().split(/\s+/);
    const vitestIndex = tokens.findIndex(
      (token, i) =>
        (token === 'vitest' || token.endsWith('/vitest')) &&
        tokens[i - 1] !== 'run' &&
        tokens[i - 1] !== 'run-script'
    );
    if (vitestIndex === -1) return false;
    return !tokens
      .slice(vitestIndex + 1)
      .some(
        (token) =>
          token === '--config' ||
          token === '-c' ||
          token === '--root' ||
          token.startsWith('--config=') ||
          token.startsWith('-c=') ||
          token.startsWith('--root=')
      );
  });
}
