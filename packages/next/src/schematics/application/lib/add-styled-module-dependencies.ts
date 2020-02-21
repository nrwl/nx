import { noop, Rule } from '@angular-devkit/schematics';
import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';

export function addStyledModuleDependencies(options: NormalizedSchema): Rule {
  const extraDependencies = CSS_IN_JS_DEPENDENCIES[options.styledModule];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
