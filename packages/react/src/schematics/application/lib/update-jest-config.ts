import { noop, Rule } from '@angular-devkit/schematics';
import { updateJestConfigContent } from '@nrwl/react/src/utils/jest-utils';
import { NormalizedSchema } from '../schema';

export function updateJestConfig(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'none'
    ? noop()
    : (host) => {
        const configPath = `${options.appProjectRoot}/jest.config.js`;
        const originalContent = host.read(configPath).toString();
        const content = updateJestConfigContent(originalContent);
        host.overwrite(configPath, content);
      };
}
