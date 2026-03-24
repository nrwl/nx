import {
    ensurePackage,
    GeneratorCallback,
    joinPathFragments,
    Tree,
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

  const { createOrEditViteConfig } = ensurePackage<typeof import('@nx/vite')>(
    '@nx/vite',
    nxVersion
  );
  ensurePackage('@nx/vitest', nxVersion);
  const { configurationGenerator } = await import('@nx/vitest/generators');

  const vitestTask = await configurationGenerator(host, {
    project: options.projectName,
    uiFramework: 'react',
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    skipFormat: true,
    addPlugin: options.addPlugin,
    runtimeTsconfigFileName: 'tsconfig.json',
    projectType: 'application',
  });

  createOrEditViteConfig(
    host,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      inSourceTests: false,
      imports: [
        options.swc
          ? `import react from '@vitejs/plugin-react-swc'`
          : `import react from '@vitejs/plugin-react'`,
      ],
      plugins: ['react()'],
      useEsmExtension: true,
    },
    true
  );

  // Rename to vitest.config.mts since Next.js uses its own bundler (not Vite)
  const viteConfigPath = joinPathFragments(
    options.appProjectRoot,
    'vite.config.mts'
  );
  const vitestConfigPath = joinPathFragments(
    options.appProjectRoot,
    'vitest.config.mts'
  );
  if (host.exists(viteConfigPath)) {
    host.rename(viteConfigPath, vitestConfigPath);
  }

  return vitestTask;
}
