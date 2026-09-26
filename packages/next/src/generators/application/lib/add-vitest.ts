import {
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/internal';

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
  }: typeof import('@nx/vitest/generators') = require('@nx/vitest/generators');
  const {
    createOrEditViteConfig,
  }: typeof import('@nx/vitest/internal') = require('@nx/vitest/internal');

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

  // Vitest cannot resolve the `@/*` alias (or workspace-root aliases in
  // non-TS-solution setups) that Next resolves itself at build time, so mirror
  // the tsconfig `paths` as explicit aliases.
  const tsConfigJson = readJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json')
  );
  const resolveAlias: Record<string, string> = {};
  const collectAliases = (
    paths: Record<string, string[]> | undefined,
    prefix: string
  ) => {
    for (const [key, targets] of Object.entries(paths ?? {})) {
      if (!targets?.[0]) {
        continue;
      }
      if (key.endsWith('/*') && targets[0].endsWith('/*')) {
        resolveAlias[key.slice(0, -2)] = prefix + targets[0].slice(0, -2);
      } else if (!key.includes('*')) {
        resolveAlias[key] = prefix + targets[0];
      }
    }
  };
  collectAliases(tsConfigJson?.compilerOptions?.paths, '');
  if (!isUsingTsSolutionSetup(host)) {
    const rootTsConfigPath = getRootTsConfigPathInTree(host);
    if (rootTsConfigPath && host.exists(rootTsConfigPath)) {
      const rootTsConfig = readJson(host, rootTsConfigPath);
      // Path mappings resolve relative to `baseUrl` when the root tsconfig
      // sets one.
      const baseUrl = rootTsConfig?.compilerOptions?.baseUrl ?? '.';
      collectAliases(
        rootTsConfig?.compilerOptions?.paths,
        joinPathFragments(offsetFromRoot(options.appProjectRoot), baseUrl) + '/'
      );
    }
  }

  createOrEditViteConfig(
    host,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      testEnvironment: 'jsdom',
      // The generated spec lives in `specs/`; colocated specs may sit under
      // `src/`, or under root `app/`/`pages/` when `--no-src` is used.
      testInclude: [
        '{src,app,pages,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      imports: [`import react from '@vitejs/plugin-react'`],
      plugins: ['react()'],
      resolveAlias,
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
  // tsconfig.spec.json extends tsconfig.base.json in TS solution setups, so
  // specs would not see the app's `@/*` alias without copying it over. Its
  // include also only covers `src/`, so add the `specs/` layout.
  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json'),
    (json) => {
      if (tsConfigJson?.compilerOptions?.paths) {
        json.compilerOptions ??= {};
        json.compilerOptions.paths = {
          ...tsConfigJson.compilerOptions.paths,
          ...json.compilerOptions.paths,
        };
      }
      if (options.js) {
        json.compilerOptions ??= {};
        json.compilerOptions.allowJs = true;
      }
      json.include = [
        ...(json.include ?? []),
        'specs/**/*.test.ts',
        'specs/**/*.spec.ts',
        'specs/**/*.test.tsx',
        'specs/**/*.spec.tsx',
        'specs/**/*.test.js',
        'specs/**/*.spec.js',
        'specs/**/*.test.jsx',
        'specs/**/*.spec.jsx',
      ];
      return json;
    }
  );

  return vitestTask;
}
