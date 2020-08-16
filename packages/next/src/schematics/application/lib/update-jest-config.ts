import { chain, noop, Rule } from '@angular-devkit/schematics';
import { NormalizedSchema } from './normalize-options';
import { updateBabelJestConfig } from '@nrwl/react/src/rules/update-babel-jest-config';

export function updateJestConfig(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'none'
    ? noop()
    : chain([
        (host) => {
          const configPath = `${options.appProjectRoot}/jest.config.js`;
          const originalContent = host.read(configPath).toString();
          const content = originalContent.replace(
            'transform: {',
            "transform: {\n    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',"
          );
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
