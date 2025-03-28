import { ensurePackage, GeneratorCallback, Tree, updateJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';
import { join } from 'node:path';

export async function addJest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  if (options.unitTestRunner === 'none') {
    return () => {};
  }

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );

  await configurationGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: options.useReactRouter ? 'react-router' : 'none',
    compiler: options.compiler,
    skipFormat: true,
    runtimeTsconfigFileName: 'tsconfig.app.json',
  });

  if (options.useReactRouter) {
    updateJson(
      host,
      join(options.appProjectRoot, 'tsconfig.spec.json'),
      (json) => {
        json.include = json.include ?? [];
        const reactRouterTestGlob = options.js
          ? [
              'test/**/*.spec.jsx',
              'test/**/*.spec.js',
              'test/**/*.test.jsx',
              'test/**/*.test.js',
            ]
          : [
              'test/**/*.spec.tsx',
              'test/**/*.spec.ts',
              'test/**/*.test.tsx',
              'test/**/*.test.ts',
            ];
        return {
          ...json,
          include: Array.from(
            new Set([...json.include, ...reactRouterTestGlob])
          ),
        };
      }
    );
  }
  return () => {};
}
