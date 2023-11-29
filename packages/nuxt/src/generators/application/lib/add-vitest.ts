import {
  Tree,
  addDependenciesToPackageJson,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import {
  happyDomVersion,
  nuxtVitestVersion,
  nxVersion,
  vitestVersion,
} from '../../../utils/versions';

export function addVitest(
  tree: Tree,
  options: NormalizedSchema,
  projectRoot: string,
  projectOffsetFromRoot: string
) {
  addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/vite': nxVersion,
      '@vitest/coverage-c8': vitestVersion,
      '@vitest/ui': vitestVersion,
      vitest: vitestVersion,
      'nuxt-vitest': nuxtVitestVersion,
      'happy-dom': happyDomVersion,
    }
  );

  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets['test'] = {
    executor: '@nx/vite:test',
    outputs: ['{options.reportsDirectory}'],
    options: {
      passWithNoTests: true,
      reportsDirectory: `${projectOffsetFromRoot}coverage/${projectRoot}`,
      config: `${projectRoot}/vitest.config.ts`,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);

  tree.write(
    joinPathFragments(projectRoot, 'vitest.config.ts'),
    `
    import { defineVitestConfig } from 'nuxt-vitest/config';
    import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

    export default defineVitestConfig({
    plugins: [nxViteTsPaths()],
    test: {
      globals: true,
      cache: {
        dir: '${projectOffsetFromRoot}node_modules/.vitest',
      },
      environment: 'nuxt',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        reportsDirectory: '${projectOffsetFromRoot}coverage/app5176218',
        provider: 'v8',
      },
    },
    });
    `
  );

  writeJson(tree, joinPathFragments(projectRoot, 'tsconfig.spec.json'), {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: `${projectOffsetFromRoot}dist/out-tsc`,
      types: ['vitest/globals', 'vitest/importMeta', 'vite/client', 'node'],
      composite: true,
    },
    include: [
      'vitest.config.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.tsx',
      'src/**/*.test.js',
      'src/**/*.spec.js',
      'src/**/*.test.jsx',
      'src/**/*.spec.jsx',
      'src/**/*.d.ts',
    ],
  });
}
