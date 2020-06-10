import { externalSchematic, noop, Rule } from '@angular-devkit/schematics';
import { NormalizedSchema } from '../schema';

export function addJest(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'jest'
    ? externalSchematic('@nrwl/jest', 'jest-project', {
        project: options.projectName,
        supportTsx: true,
        skipSerializers: true,
        setupFile: 'none',
        babelJest: true,
      })
    : noop();
}
