import { joinPathFragments, readJson, type Tree } from '@nx/devkit';
import { getPackageJsonModuleFormat } from './module-format';

/**
 * Determine whether a project should be treated as ESM for the purpose of
 * emitting `.ts` config and source files (e.g. choosing between
 * `__filename`/`__dirname` and `import.meta.dirname`, or `require()` and
 * `import` for sibling subpath imports).
 *
 * Mirrors Node's package.json `type` resolution: the **closest**
 * package.json with a recognized `type` field wins.
 *
 * Resolution order:
 * 1. The project's package.json `type`, if present and recognized.
 * 2. The workspace-root package.json `type`, if present and recognized.
 * 3. Default: `false` (CJS).
 */
export function isEsmProject(tree: Tree, projectRoot: string): boolean {
  const projectPackageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (tree.exists(projectPackageJsonPath)) {
    const projectFmt = getPackageJsonModuleFormat(
      readJson(tree, projectPackageJsonPath)
    );
    // Only honor an explicit type field; fall through to workspace when
    // unset so we match Node's "walk up to nearest type field" behavior.
    if (projectFmt !== null) {
      return projectFmt === 'esm';
    }
  }

  const workspaceFmt = getPackageJsonModuleFormat(
    readJson(tree, 'package.json')
  );
  return workspaceFmt === 'esm';
}
