import { Tree } from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export function getEslintTargets(tree: Tree) {
  const eslintTargetNames = new Set<string>();
  forEachExecutorOptions(tree, '@nrwl/linter:eslint', (_, __, target) => {
    eslintTargetNames.add(target);
  });
  return eslintTargetNames;
}
