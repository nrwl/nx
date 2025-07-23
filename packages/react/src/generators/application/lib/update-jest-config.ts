import { maybeJs } from '../../../utils/maybe-js';
import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';
import { Tree, updateJson, offsetFromRoot } from '@nx/devkit';

export function updateSpecConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner === 'none') {
    return;
  }

  updateJson(host, `${options.appProjectRoot}/tsconfig.spec.json`, (json) => {
    const compilerOptions = json.compilerOptions ?? {};
    const types = compilerOptions.types ?? [];
    compilerOptions.types = types;
    json.compilerOptions = compilerOptions;

    // Add React typings to files array instead of types for better pnpm compatibility
    if (!json.files) {
      json.files = [];
    }
    const offset = offsetFromRoot(options.appProjectRoot);
    if (options.style === 'styled-jsx') {
      json.files.push(
        `${offset}node_modules/@nx/react/typings/styled-jsx.d.ts`
      );
    }
    json.files.push(
      `${offset}node_modules/@nx/react/typings/cssmodule.d.ts`,
      `${offset}node_modules/@nx/react/typings/image.d.ts`
    );

    if (options.isUsingTsSolutionConfig) {
      // add project reference to the runtime tsconfig.app.json file
      json.references ??= [];
      json.references.push({ path: './tsconfig.app.json' });
    }
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
