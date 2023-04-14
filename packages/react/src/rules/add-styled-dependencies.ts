import { CSS_IN_JS_DEPENDENCIES } from '../utils/styled';
import { addDependenciesToPackageJson, Tree } from '@nx/devkit';

export function addStyledModuleDependencies(host: Tree, styledModule: string) {
  const extraDependencies = CSS_IN_JS_DEPENDENCIES[styledModule];

  if (extraDependencies) {
    return addDependenciesToPackageJson(
      host,
      extraDependencies.dependencies,
      extraDependencies.devDependencies
    );
  } else {
    return () => {};
  }
}
