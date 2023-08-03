import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';
import { Tree } from '@nx/devkit';

export function updateSpecConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === 'jest') {
    const configPath = `${options.appProjectRoot}/jest.config.${
      options.js ? 'js' : 'ts'
    }`;
    const originalContent = host.read(configPath, 'utf-8');
    const content = updateJestConfigContent(originalContent);
    host.write(configPath, content);
  }
}
