import { chain, noop, Rule } from '@angular-devkit/schematics';
import { updateBabelJestConfig } from '../../../rules/update-babel-jest-config';
import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';
import { offsetFromRoot, updateJsonInTree } from '@nrwl/workspace';

export function updateJestConfig(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'none'
    ? noop()
    : chain([
        updateJsonInTree(
          `${options.appProjectRoot}/tsconfig.spec.json`,
          (json) => {
            const offset = offsetFromRoot(options.appProjectRoot);
            json.files = [
              `${offset}node_modules/@nrwl/react/typings/cssmodule.d.ts`,
              `${offset}node_modules/@nrwl/react/typings/image.d.ts`,
            ];
            if (options.style === 'styled-jsx') {
              json.files.unshift(
                `${offset}node_modules/@nrwl/react/typings/styled-jsx.d.ts`
              );
            }
            return json;
          }
        ),
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
