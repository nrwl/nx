import { noop, Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';
import { NEXT_SPECIFIC_STYLE_DEPENDENCIES } from '../../../utils/styles';

export function addStyleDependencies(options: NormalizedSchema): Rule {
  const extraDependencies = NEXT_SPECIFIC_STYLE_DEPENDENCIES[options.style];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
