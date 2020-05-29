import { noop, Rule } from '@angular-devkit/schematics';
import { NormalizedSchema } from './normalize-options';

export function updateJestConfig(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'none'
    ? noop()
    : (host) => {
        const configPath = `${options.appProjectRoot}/jest.config.js`;
        const originalContent = host.read(configPath).toString();
        const content = originalContent.replace(
          'transform: {',
          "transform: {\n    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest',"
        );
        host.overwrite(configPath, content);
      };
}
