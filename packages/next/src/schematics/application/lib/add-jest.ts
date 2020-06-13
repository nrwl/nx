import {
  chain,
  externalSchematic,
  noop,
  Rule,
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';
import { join } from '@angular-devkit/core';

export function addJest(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'jest'
    ? chain([
        externalSchematic('@nrwl/jest', 'jest-project', {
          project: options.projectName,
          supportTsx: true,
          skipSerializers: true,
          setupFile: 'none',
        }),
        updateJsonInTree(
          join(options.appProjectRoot, 'tsconfig.spec.json'),
          (json) => {
            json.compilerOptions = {
              ...json.compilerOptions,
              jsx: 'react',
              module: 'commonjs',
              allowJs: true,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              forceConsistentCasingInFileNames: true,
              noEmit: true,
              resolveJsonModule: true,
              isolatedModules: true,
            };
            return json;
          }
        ),
      ])
    : noop();
}
