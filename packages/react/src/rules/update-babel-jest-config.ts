import { Tree, updateJson } from '@nrwl/devkit';

type BabelJestConfigUpdater<T> = (json: T) => T;

export function updateBabelJestConfig<T = any>(
  host: Tree,
  projectRoot: string,
  update: BabelJestConfigUpdater<T>
) {
  const configPath = `${projectRoot}/babel-jest.config.json`;
  if (host.exists(configPath)) {
    updateJson(host, configPath, update);
  }
}
