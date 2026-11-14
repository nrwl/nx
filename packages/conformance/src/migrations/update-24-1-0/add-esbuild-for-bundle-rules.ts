import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readJson,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import { readTargetDefaultsForTarget } from '@nx/devkit/internal';
import { esbuildVersion } from '../../utils/versions';

const BUNDLE_RULES_EXECUTOR = '@nx/conformance:bundle-rules';

export default async function update(tree: Tree) {
  if (
    !tree.exists('package.json') ||
    !usesBundleRules(tree) ||
    declaresEsbuild(tree)
  ) {
    return;
  }

  addDependenciesToPackageJson(tree, {}, { esbuild: esbuildVersion });
  await formatFiles(tree);
}

function usesBundleRules(tree: Tree): boolean {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  for (const [, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      const executor =
        target.executor ??
        readTargetDefaultsForTarget(targetName, targetDefaults)?.executor;
      if (executor === BUNDLE_RULES_EXECUTOR) {
        return true;
      }
    }
  }
  return false;
}

function declaresEsbuild(tree: Tree): boolean {
  const { dependencies = {}, devDependencies = {} } = readJson(
    tree,
    'package.json'
  );
  return Boolean(dependencies.esbuild || devDependencies.esbuild);
}
