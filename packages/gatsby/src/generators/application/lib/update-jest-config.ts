import { NormalizedSchema } from './normalize-options';
import { Tree } from '@nrwl/devkit';
import { updateJestConfigContent } from '@nrwl/react/src/utils/jest-utils';

export function updateJestConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner !== 'jest') {
    return;
  }

  const configPath = `${options.projectRoot}/jest.config.js`;
  const originalContent = host.read(configPath).toString();
  const content = updateJestConfigContent(originalContent);
  host.write(configPath, content);
}
