import {
  chain,
  externalSchematic,
  noop,
  Rule,
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';

export function addJest(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'jest'
    ? chain([
        externalSchematic('@nrwl/jest', 'jest-project', {
          project: options.projectName,
          supportTsx: true,
          skipSerializers: true,
          setupFile: 'none',
          babelJest: true,
        }),

        updateJsonInTree(
          `${options.appProjectRoot}/tsconfig.spec.json`,
          (json) => {
            json.compilerOptions.jsx = 'react';
            return json;
          }
        ),
      ])
    : noop();
}
