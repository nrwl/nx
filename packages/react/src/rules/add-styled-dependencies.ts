import { noop, Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { CSS_IN_JS_DEPENDENCIES } from '../utils/styled';

export function addStyledModuleDependencies(styledModule: string): Rule {
  const extraDependencies = CSS_IN_JS_DEPENDENCIES[styledModule];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
