import {
  removeDependenciesFromPackageJson,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';

export function removeExpoCli(tree: Tree): GeneratorCallback {
  return removeDependenciesFromPackageJson(tree, [], ['expo-cli']);
}

export default removeExpoCli;
