import { maybeJs } from '../../../utils/maybe-js';
import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';
import { Tree, updateJson } from '@nx/devkit';

export function updateSpecConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === 'none') {
    return;
  }

  updateJson(host, `${options.appProjectRoot}/tsconfig.spec.json`, (json) => {
    const compilerOptions = json.compilerOptions ?? {};
    const types = compilerOptions.types ?? [];
    if (options.style === 'styled-jsx') {
      types.push('@nx/react/typings/styled-jsx.d.ts');
    }
    types.push(
      '@nx/react/typings/cssmodule.d.ts',
      '@nx/react/typings/image.d.ts'
    );
    compilerOptions.types = types;
    json.compilerOptions = compilerOptions;
    return json;
  });

  if (options.unitTestRunner !== 'jest') {
    return;
  }

  const configPath = maybeJs(
    options,
    `${options.appProjectRoot}/jest.config.ts`
  );
  const originalContent = host.read(configPath, 'utf-8');
  const content = updateJestConfigContent(originalContent);
  host.write(configPath, content);
}
