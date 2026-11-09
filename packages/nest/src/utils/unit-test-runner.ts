import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { coerce, lt, major } from 'semver';
import { getInstalledNestJsVersion, nestJsVersion } from './versions';

const firstEsmOnlyNestJsMajor = 12;
// Jest loads the ESM-only Nest 12 packages through its require(esm) support,
// which needs Jest 30.5, Node.js 24.9 and `--experimental-vm-modules`.
export const jestNodeFloor = '24.9.0';
export const jestEsmVersion = '^30.5.0';
const jestNodeOptions = '--experimental-vm-modules';

// A missing or unresolvable version (e.g. `workspace:`) falls back to the
// latest major, like `versions()` does.
function getNestJsMajor(tree: Tree): number {
  return major(
    getInstalledNestJsVersion(tree) ?? coerce(nestJsVersion)!.version
  );
}

export function usesEsmOnlyNestJs(tree: Tree): boolean {
  return getNestJsMajor(tree) >= firstEsmOnlyNestJsMajor;
}

export function getDefaultUnitTestRunner(tree: Tree): 'jest' | 'vitest' {
  return usesEsmOnlyNestJs(tree) ? 'vitest' : 'jest';
}

export function assertJestSupported(tree: Tree): void {
  const nodeVersion = process.versions.node;
  if (!usesEsmOnlyNestJs(tree) || !lt(nodeVersion, jestNodeFloor)) {
    return;
  }

  throw new Error(
    `Using jest with Nest ${firstEsmOnlyNestJsMajor} requires Node.js ${jestNodeFloor} or later, but this runs on Node.js ${nodeVersion}.\n` +
      `Nest ${firstEsmOnlyNestJsMajor} is ESM only, and Jest loads it only on Node.js ${jestNodeFloor}+ with ${jestNodeOptions}, which Nx sets up for you.\n` +
      `Upgrade Node.js to ${jestNodeFloor} or later, generate with "--unitTestRunner=vitest", or add "@nestjs/core@^${firstEsmOnlyNestJsMajor - 1}.0.0" to the workspace first to keep Nest ${firstEsmOnlyNestJsMajor - 1}.`
  );
}

/**
 * Lets a project's Jest target load Nest 12: upgrades Jest to 30.5 and runs
 * the target with `--experimental-vm-modules`, keeping the inferred env.
 */
export function configureJestForEsmOnlyNestJs(
  tree: Tree,
  projectName: string
): GeneratorCallback {
  const targetName = getJestTargetName(tree);
  const project = readProjectConfiguration(tree, projectName);
  project.targets ??= {};
  const target = (project.targets[targetName] ??= {});
  target.options = {
    ...target.options,
    env: {
      '...': true,
      ...target.options?.env,
      NODE_OPTIONS: jestNodeOptions,
    },
  };
  updateProjectConfiguration(tree, projectName, project);

  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  const declared = { ...dependencies, ...devDependencies };
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      jest: jestEsmVersion,
      ...(declared['jest-environment-node']
        ? { 'jest-environment-node': jestEsmVersion }
        : {}),
    },
    undefined,
    false
  );
}

function getJestTargetName(tree: Tree): string {
  for (const plugin of readNxJson(tree)?.plugins ?? []) {
    if (typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin') {
      return (plugin.options as { targetName?: string })?.targetName ?? 'test';
    }
  }
  return 'test';
}
