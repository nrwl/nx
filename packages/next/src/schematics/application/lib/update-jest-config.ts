import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { NormalizedSchema } from './normalize-options';
import { updateJsonInTree } from '@nrwl/workspace';

type BabelJestConfigUpdater<T> = (json: T) => T;

function updateBabelJestConfigOriginal<T = any>(
  projectRoot: string,
  update: BabelJestConfigUpdater<T>
) {
  return (host: Tree) => {
    const configPath = `${projectRoot}/babel-jest.config.json`;
    return host.exists(configPath)
      ? updateJsonInTree<T>(configPath, update)
      : noop();
  };
}

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
        updateBabelJestConfigOriginal(options.appProjectRoot, (json) => {
          if (options.style === 'styled-jsx') {
            json.plugins = (json.plugins || []).concat('styled-jsx/babel');
          }
          return json;
        }),
      ]);
}
