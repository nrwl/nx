import { walkTsconfigExtendsChain } from '@nx/js/internal';
import type { RawTsconfigJsonCache } from '@nx/js/internal';
import { getRootTsConfigFileName } from '@nx/js';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ResolvedConfig } from 'vite';

/**
 * Resolves the files Vitest loads from outside the project root - `setupFiles`
 * and `globalSetup`. `collectSetupFileInputs` declares the ones that exist,
 * together with the tsconfigs Vite reads to transform them.
 *
 * `default` covers everything under `{projectRoot}`, and `^production` covers a
 * dependency's sources, but a setup file in a shared directory is neither. Left
 * undeclared, editing it does not invalidate the task and the suite replays a
 * stale cache hit.
 *
 * Reads the build-resolved config, as the inferred target's inputs are built
 * from it. Setup files contributed by an `apply: 'serve'` plugin are therefore
 * invisible here - the same build/serve divergence the atomized path documents.
 *
 * Solution-style tsconfigs are deliberately not followed. When the nearest
 * tsconfig of a setup file is a solution file, Vite walks its `references` and
 * reads every project's tsconfig; declaring those would attach one input per
 * project in the workspace. Keep the setup file inside a project (or beside a
 * leaf tsconfig) instead.
 */
export function resolveSetupFileCandidates(
  viteConfig: ResolvedConfig,
  projectRoot: string,
  workspaceRoot: string,
  /** `root` as the config authored it, before vite defaults it to `cwd`. */
  authoredViteRoot?: string
): string[] {
  // At the workspace root everything is already covered by `default`.
  if (projectRoot === '.') return [];

  const entries = [
    viteConfig.test?.setupFiles,
    viteConfig.test?.globalSetup,
  ].flatMap((value) =>
    typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  );
  if (entries.length === 0) return [];

  // Vitest resolves both options against its root, and the inferred target
  // runs with `cwd` set to the project root - so a config that authors no
  // root resolves them against the project, not `viteConfig.root` (which vite
  // has already defaulted to the graph process's cwd). Mirrors
  // `effectiveVitestRoot` in plugin.ts.
  const fullProjectRoot = resolve(workspaceRoot, projectRoot);
  const authoredRoot = viteConfig.test?.root ?? authoredViteRoot;
  const configRoot = !authoredRoot
    ? fullProjectRoot
    : isAbsolute(authoredRoot)
      ? authoredRoot
      : resolve(fullProjectRoot, authoredRoot);

  const candidates = new Set<string>();
  for (const entry of entries) {
    const absolutePath = isAbsolute(entry) ? entry : resolve(configRoot, entry);
    const wsRelative = declarable(absolutePath, projectRoot, workspaceRoot);
    if (wsRelative) candidates.add(wsRelative);
  }
  return [...candidates];
}

export function collectSetupFileInputs(
  setupFileCandidates: string[],
  projectRoot: string,
  workspaceRoot: string,
  jsonCache: RawTsconfigJsonCache
): { files: string[]; tsconfigs: string[] } {
  const rootTsConfigName = getRootTsConfigFileName();
  const files: string[] = [];
  const tsconfigs = new Set<string>();

  for (const file of setupFileCandidates) {
    const absolutePath = join(workspaceRoot, file);
    if (!existsSync(absolutePath)) continue;
    files.push(file);

    // The tsconfig Vite resolves for the file: the nearest one walking up,
    // plus its extends chain.
    let dir = dirname(absolutePath);
    while (dir.startsWith(workspaceRoot)) {
      const candidate = join(dir, 'tsconfig.json');
      if (existsSync(candidate)) {
        walkTsconfigExtendsChain(
          candidate,
          (absPath) => {
            const relativePath = declarable(
              absPath,
              projectRoot,
              workspaceRoot
            );
            if (relativePath && relativePath !== rootTsConfigName) {
              tsconfigs.add(relativePath);
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

  return { files, tsconfigs: [...tsconfigs] };
}

/** Workspace-relative path, or null when it is not ours to declare. */
function declarable(
  absolutePath: string,
  projectRoot: string,
  workspaceRoot: string
): string | null {
  const wsRelative = relative(workspaceRoot, absolutePath).split(sep).join('/');
  // Outside the workspace → cannot be expressed as an input.
  if (wsRelative.startsWith('../') || wsRelative === '..') return null;
  // Inside node_modules → invalidated via the lockfile.
  if (
    wsRelative.startsWith('node_modules/') ||
    wsRelative.includes('/node_modules/')
  )
    return null;
  // Inside the project → covered by `default`.
  if (wsRelative === projectRoot || wsRelative.startsWith(`${projectRoot}/`))
    return null;
  return wsRelative;
}
