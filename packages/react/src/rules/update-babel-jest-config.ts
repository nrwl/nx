import { noop, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';

type BabelJestConfigUpdater<T> = (json: T) => T;

export function updateBabelJestConfig<T = any>(
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
