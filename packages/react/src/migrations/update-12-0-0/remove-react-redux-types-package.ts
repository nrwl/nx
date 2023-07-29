import { removeDependenciesFromPackageJson, Tree } from '@nx/devkit';

export async function removeReactReduxTypesFromPackageJson(host: Tree) {
  return removeDependenciesFromPackageJson(
    host,
    ['@types/react-redux'],
    ['@types/react-redux']
  );
}

export default removeReactReduxTypesFromPackageJson;
