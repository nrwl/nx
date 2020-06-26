import { chain, noop, Rule } from '@angular-devkit/schematics';
import { updateBabelJestConfig } from '../../../rules/update-babel-jest-config';
import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';

export function updateJestConfig(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'none'
    ? noop()
    : chain([
        (host) => {
          const configPath = `${options.appProjectRoot}/jest.config.js`;
          const originalContent = host.read(configPath).toString();
          const content = updateJestConfigContent(originalContent);
          host.overwrite(configPath, content);
        },
        updateBabelJestConfig(options.appProjectRoot, (json) => {
          if (options.style === 'styled-jsx') {
            json.plugins = (json.plugins || []).concat('styled-jsx/babel');
          }
          return json;
        }),
      ]);
}
