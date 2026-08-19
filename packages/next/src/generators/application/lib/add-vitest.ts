import {
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addVitest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  if (options.unitTestRunner !== 'vitest') {
    return () => {};
  }

  ensurePackage('@nx/vitest', nxVersion);
  // CommonJS `require` instead of dynamic ESM `import`: `ensurePackage` exposes
  // the temp install via `Module._initPaths`, which ESM ignores.
  const {
    configurationGenerator,
    createOrEditViteConfig,
  }: typeof import('@nx/vitest/generators') = require('@nx/vitest/generators');

  const vitestTask = await configurationGenerator(host, {
    project: options.projectName,
    uiFramework: 'react',
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    runtimeTsconfigFileName: 'tsconfig.json',
    // Next.js builds with its own toolchain, so the project has no vite config
    // to extend. Write a standalone vitest config below instead.
    skipViteConfig: true,
    addPlugin: options.addPlugin,
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
  });

  createOrEditViteConfig(
    host,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      testEnvironment: 'jsdom',
      // The generated spec lives in `specs/` (files under `pages/` become
      // routes), but users may still colocate specs under `src/`.
      testInclude: [
        '{src,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      imports: [`import react from '@vitejs/plugin-react'`],
      plugins: ['react()'],
      useEsmExtension: true,
    },
    true,
    {
      vitestFileName: true,
      skipPackageJson: options.skipPackageJson,
      skipNxPlugins: true,
    }
  );

  // The generated specs live in `specs/`, which only tsconfig.json covers, so
  // it needs the test types (vitest globals, node) from tsconfig.spec.json.
  const tsConfigSpecJson = readJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json')
  );
  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      json.compilerOptions ??= {};
      json.compilerOptions.types ??= [];
      json.compilerOptions.types.push(
        ...(tsConfigSpecJson?.compilerOptions?.types ?? [])
      );
      return json;
    }
  );

  return vitestTask;
}
