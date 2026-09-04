import { walkTsconfigExtendsChain } from '@nx/js/internal';
import type { RawTsconfigJsonCache } from '@nx/js/internal';
import { getRootTsConfigFileName } from '@nx/js';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ResolvedConfig } from 'vite';

/**
 * Collects the files Vitest loads from outside the project root - `setupFiles`
 * and `globalSetup` - together with the tsconfigs Vite reads to transform them.
 *
 * `default` covers everything under `{projectRoot}`, and `^production` covers a
 * dependency's sources, but a setup file in a shared directory is neither. Left
 * undeclared, editing it does not invalidate the task and the suite replays a
 * stale cache hit.
 *
 * Solution-style tsconfigs are deliberately not followed. When the nearest
 * tsconfig of a setup file is a solution file, Vite walks its `references` and
 * reads every project's tsconfig; declaring those would attach one input per
 * project in the workspace. Keep the setup file inside a project (or beside a
 * leaf tsconfig) instead.
 */
export function collectSetupFileInputs(
  viteConfig: ResolvedConfig,
  projectRoot: string,
  workspaceRoot: string
): { files: string[]; tsconfigs: string[] } {
  // At the workspace root everything is already covered by `default`.
  if (projectRoot === '.') return { files: [], tsconfigs: [] };

  const entries = [
    viteConfig.test?.setupFiles,
    viteConfig.test?.globalSetup,
  ].flatMap((value) =>
    typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  );
  if (entries.length === 0) return { files: [], tsconfigs: [] };

  // Vitest resolves both options against the config's root.
  const configRoot = viteConfig.test?.root ?? viteConfig.root ?? workspaceRoot;
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
