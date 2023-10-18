import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';
import { Tree, updateJson } from '@nx/devkit';

export function updateSpecConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === 'none') {
    return;
  }

  updateJson(host, `${options.appProjectRoot}/tsconfig.spec.json`, (json) => {
    json.types = json.types || [];
    if (options.style === 'styled-jsx') {
      json.types.push('@nx/react/typings/styled-jsx.d.ts');
    }
    json.types = [
      ...json.types,
      '@nx/react/typings/cssmodule.d.ts',
      '@nx/react/typings/image.d.ts',
    ];
    return json;
  });

  if (options.unitTestRunner !== 'jest') {
    return;
  }

  const configPath = `${options.appProjectRoot}/jest.config.${
    options.js ? 'js' : 'ts'
  }`;
  const originalContent = host.read(configPath, 'utf-8');
  const content = updateJestConfigContent(originalContent);
  host.write(configPath, content);
}
