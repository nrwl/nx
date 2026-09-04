import { walkTsconfigExtendsChain } from '@nx/js/internal';
import type { RawTsconfigJsonCache } from '@nx/js/internal';
import { getRootTsConfigFileName } from '@nx/js';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ResolvedConfig } from 'vite';

/**
 * The setup entries read off a Vite config, in the raw form the user wrote
 * them. Resolving them touches the filesystem, so it is kept separate from
 * reading them: the entries are cached with the target definitions, while the
 * resolution re-runs on every graph build (see `collectSetupFileInputs`).
 */
export interface SetupFileEntries {
  entries: string[];
  /** `test.root`, unresolved - Vite does not normalize the `test` block. */
  testRoot?: string;
}

/** Reads `setupFiles` and `globalSetup` off a resolved Vite config. */
export function readSetupFileEntries(
  viteConfig: ResolvedConfig
): SetupFileEntries {
  const entries = [
    viteConfig.test?.setupFiles,
    viteConfig.test?.globalSetup,
  ].flatMap((value) =>
    typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  );
  const testRoot = viteConfig.test?.root;
  return {
    entries: entries.filter((e): e is string => typeof e === 'string'),
    testRoot: typeof testRoot === 'string' ? testRoot : undefined,
  };
}

/**
 * Collects the files Vitest loads from outside the project root - `setupFiles`
 * and `globalSetup` - together with the tsconfigs Vite reads to transform them.
 *
 * `default` covers everything under `{projectRoot}`, and `^production` covers a
 * dependency's sources, but a setup file in a shared directory is neither. Left
 * undeclared, editing it does not invalidate the task and the suite replays a
 * stale cache hit.
 *
 * Stops at the nearest tsconfig and its `extends` chain. Vite reads more than
 * that for a solution-style tsconfig - it walks `references` and reads every
 * referenced project's tsconfig - but declaring those would attach one input
 * per project in the workspace. Keep the setup file inside a project (or beside
 * a leaf tsconfig) instead.
 */
export function collectSetupFileInputs(
  { entries, testRoot }: SetupFileEntries,
  projectRoot: string,
  workspaceRoot: string
): { files: string[]; tsconfigs: string[] } {
  // At the workspace root everything is already covered by `default`.
  if (projectRoot === '.') return { files: [], tsconfigs: [] };
  if (entries.length === 0) return { files: [], tsconfigs: [] };

  // Vitest resolves both options against its own root, which is the config's
  // directory - the project root, since a project is registered per config -
  // unless `test.root` overrides it. The Vite-resolved `root` cannot stand in:
  // it defaults to `process.cwd()` when the config omits `root`, which would
  // resolve every entry against wherever nx happened to be invoked.
  const fullProjectRoot = resolve(workspaceRoot, projectRoot);
  const configRoot = !testRoot
    ? fullProjectRoot
    : isAbsolute(testRoot)
      ? testRoot
      : resolve(fullProjectRoot, testRoot);

  const jsonCache: RawTsconfigJsonCache = new Map();
  const rootTsConfigName = getRootTsConfigFileName();
  const projectPrefix = `${projectRoot}/`;
  const files: string[] = [];
  const tsconfigs: string[] = [];
  const seen = new Set<string>();

  /** Workspace-relative path, or null when it is not ours to declare. */
  const declarable = (absolutePath: string): string | null => {
    const wsRelative = relative(workspaceRoot, absolutePath)
      .split(sep)
      .join('/');
    if (seen.has(wsRelative)) return null;
    seen.add(wsRelative);
    // Outside the workspace → cannot be expressed as an input.
    if (wsRelative.startsWith('../') || wsRelative === '..') return null;
    // Inside node_modules → invalidated via the lockfile.
    if (
      wsRelative.startsWith('node_modules/') ||
      wsRelative.includes('/node_modules/')
    )
      return null;
    // Inside the project → covered by `default`.
    if (wsRelative === projectRoot || wsRelative.startsWith(projectPrefix))
      return null;
    return wsRelative;
  };

  for (const entry of entries) {
    const absolutePath = isAbsolute(entry) ? entry : resolve(configRoot, entry);
    if (!existsSync(absolutePath)) continue;

    const wsRelative = declarable(absolutePath);
    if (!wsRelative) continue;
    files.push(wsRelative);

    // The tsconfig Vite resolves for the file: the nearest one walking up,
    // plus its extends chain.
    let dir = dirname(absolutePath);
    while (dir.startsWith(workspaceRoot)) {
      const candidate = join(dir, 'tsconfig.json');
      if (existsSync(candidate)) {
        walkTsconfigExtendsChain(
          candidate,
          (absPath) => {
            const relativePath = declarable(absPath);
            if (relativePath && relativePath !== rootTsConfigName) {
              tsconfigs.push(relativePath);
            }
            return 'continue';
          },
          { jsonCache }
        );
        break;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return { files, tsconfigs };
}
