import { joinPathFragments, readJson, type Tree } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '../typescript/ts-solution-setup';
import { getPackageJsonModuleFormat } from './module-format';

/**
 * Determine whether a project should be treated as ESM for the purpose of
 * emitting `.ts` config and source files (e.g. choosing between
 * `__filename`/`__dirname` and `import.meta.dirname`, or `require()` and
 * `import` for sibling subpath imports).
 *
 * Mirrors Node's package.json `type` resolution: the **closest**
 * package.json wins, but only if it has a `type` field. A project-level
 * package.json without `type` does NOT shadow the workspace-root `type`
 * (Node would walk up). This matters when a generator runs against an
 * apps-preset project where the project has a thin package.json with no
 * `type` field but the workspace declares `"type": "module"` - Node will
 * load `.ts` files as ESM, and so must our emit.
 *
 * Resolution order:
 * 1. TS solution workspaces always answer `true` - each project's
 *    package.json is expected to declare `"type": "module"`, even when
 *    the project's own package.json hasn't been written yet at the
 *    moment a generator is making this decision.
 * 2. The project's package.json `type`, if present and recognized.
 * 3. The workspace-root package.json `type`, if present and recognized.
 * 4. Default: `false` (CJS).
 */
export function isEsmProject(tree: Tree, projectRoot: string): boolean {
  if (isUsingTsSolutionSetup(tree)) {
    return true;
  }

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
