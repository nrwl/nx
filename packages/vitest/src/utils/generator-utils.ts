import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { VitestExecutorOptions } from '../executors/test/schema';
import { nxVersion } from './versions';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';

export type Target = 'build' | 'serve' | 'test' | 'preview';
export type TargetFlags = Partial<Record<Target, boolean>>;

export interface VitestGeneratorSchema {
  project: string;
  uiFramework?: 'angular' | 'react' | 'vue' | 'none';
  coverageProvider: 'v8' | 'istanbul' | 'custom' | 'none';
  inSourceTests?: boolean;
  skipViteConfig?: boolean;
  testTarget?: string;
  skipFormat?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  addPlugin?: boolean;
  runtimeTsconfigFileName?: string;
  compiler?: 'babel' | 'swc';
  projectType?: 'application' | 'library';
}

export function addOrChangeTestTarget(
  tree: Tree,
  options: VitestGeneratorSchema,
  hasPlugin: boolean
) {
  const nxJson = readNxJson(tree);

  hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/vitest'
      : p.plugin === '@nx/vitest' || hasPlugin
  );

  if (hasPlugin) {
    return;
  }

  const project = readProjectConfiguration(tree, options.project);
  const target = options.testTarget ?? 'test';

  const reportsDirectory = joinPathFragments(
    offsetFromRoot(project.root),
    'coverage',
    project.root === '.' ? options.project : project.root
  );
  const testOptions: VitestExecutorOptions = {
    reportsDirectory,
  };

  project.targets ??= {};

  if (project.targets[target]) {
    throw new Error(`Target "${target}" already exists in the project.`);
  } else {
    project.targets[target] = {
      executor: '@nx/vitest:test',
      outputs: ['{options.reportsDirectory}'],
      options: testOptions,
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

export interface ViteConfigFileOptions {
  project: string;
  includeLib?: boolean;
  includeVitest?: boolean;
  inSourceTests?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  rollupOptionsExternal?: string[];
  imports?: string[];
  plugins?: string[];
  coverageProvider?: 'v8' | 'istanbul' | 'custom' | 'none';
  setupFile?: string;
  useEsmExtension?: boolean;
  port?: number;
  previewPort?: number;
}

export function createOrEditViteConfig(
  tree: Tree,
  options: ViteConfigFileOptions,
  onlyVitest: boolean,
  extraOptions: {
    projectAlreadyHasViteTargets?: TargetFlags;
    skipPackageJson?: boolean;
    vitestFileName?: boolean;
  } = {}
) {
  const { root: projectRoot } = readProjectConfiguration(tree, options.project);

  const extension = options.useEsmExtension ? 'mts' : 'ts';
  const viteConfigPath = extraOptions.vitestFileName
    ? `${projectRoot}/vitest.config.${extension}`
    : `${projectRoot}/vite.config.${extension}`;

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const buildOutDir = isTsSolutionSetup
    ? './dist'
    : projectRoot === '.'
      ? `./dist/${options.project}`
      : `${offsetFromRoot(projectRoot)}dist/${projectRoot}`;

  const buildOption = onlyVitest
    ? ''
    : options.includeLib
      ? `  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: '${buildOutDir}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '${options.project}',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const]
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [${options.rollupOptionsExternal ?? ''}]
    },
  },`
      : `  build: {
    outDir: '${buildOutDir}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },`;

  const imports: string[] = options.imports ? [...options.imports] : [];
  const plugins: string[] = options.plugins ? [...options.plugins] : [];

  if (!onlyVitest && options.includeLib && !isTsSolutionSetup) {
    imports.push(
      `import dts from 'vite-plugin-dts'`,
      `import * as path from 'path'`
    );
  }

  if (!isTsSolutionSetup) {
    imports.push(
      `import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'`,
      `import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'`
    );
    plugins.push(`nxViteTsPaths()`, `nxCopyAssetsPlugin(['*.md'])`);
    if (!extraOptions.skipPackageJson) {
      addDependenciesToPackageJson(tree, {}, { '@nx/vite': nxVersion });
    }
  }

  if (!onlyVitest && options.includeLib) {
    plugins.push(
      `dts({ entryRoot: 'src', tsconfigPath: path.join(__dirname, 'tsconfig.lib.json')${
        !isTsSolutionSetup ? ', pathsToAliases: false' : ''
      } })`
    );
  }

  const reportsDirectory = isTsSolutionSetup
    ? './test-output/vitest/coverage'
    : projectRoot === '.'
      ? `./coverage/${options.project}`
      : `${offsetFromRoot(projectRoot)}coverage/${projectRoot}`;

  const testOption = options.includeVitest
    ? `  test: {
    name: '${options.project}',
    watch: false,
    globals: true,
    environment: '${options.testEnvironment ?? 'jsdom'}',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
${options.setupFile ? `    setupFiles: ['${options.setupFile}'],\n` : ''}\
${
  options.inSourceTests
    ? `    includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],\n`
    : ''
}\
    reporters: ['default']${
      options.coverageProvider !== 'none'
        ? `,
    coverage: {
      reportsDirectory: '${reportsDirectory}',
      provider: ${
        options.coverageProvider
          ? `'${options.coverageProvider}' as const`
          : `'v8' as const`
      },
    }`
        : ''
    }
  },`
    : '';

  const defineOption = options.inSourceTests
    ? `  define: {
    'import.meta.vitest': undefined
  },`
    : '';

  const devServerOption = onlyVitest
    ? ''
    : options.includeLib
      ? ''
      : `  server:{
    port: ${options.port ?? 4200},
    host: 'localhost',
  },`;

  const previewServerOption = onlyVitest
    ? ''
    : options.includeLib
      ? ''
      : `  preview:{
    port: ${options.previewPort ?? 4300},
    host: 'localhost',
  },`;

  const workerOption = isTsSolutionSetup
    ? `  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },`
    : `  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },`;

  const cacheDir = `cacheDir: '${normalizedJoinPaths(
    offsetFromRoot(projectRoot),
    'node_modules',
    '.vite',
    projectRoot === '.' ? options.project : projectRoot
  )}',`;

  if (tree.exists(viteConfigPath)) {
    handleViteConfigFileExists(
      tree,
      viteConfigPath,
      options,
      buildOption,
      buildOutDir,
      imports,
      plugins,
      testOption,
      reportsDirectory,
      cacheDir,
      projectRoot,
      offsetFromRoot(projectRoot),
      extraOptions.projectAlreadyHasViteTargets
    );
    return;
  }

  // When using vitest.config, use vitest/config import and skip vite-specific options
  const viteConfigContent = extraOptions.vitestFileName
    ? `import { defineConfig } from 'vitest/config';
${imports.join(';\n')}${imports.length ? ';' : ''}

export default defineConfig(() => ({
  root: __dirname,
  ${printOptions(
    cacheDir,
    plugins.length ? `  plugins: [${plugins.join(', ')}],` : '',
    defineOption,
    testOption
  )}
}));
`.replace(/\s+(?=(\n|$))/gm, '\n')
    : `/// <reference types='vitest' />
import { defineConfig } from 'vite';
${imports.join(';\n')}${imports.length ? ';' : ''}

export default defineConfig(() => ({
  root: __dirname,
  ${printOptions(
    cacheDir,
    devServerOption,
    previewServerOption,
    `  plugins: [${plugins.join(', ')}],`,
    workerOption,
    buildOption,
    defineOption,
    testOption
  )}
}));
`.replace(/\s+(?=(\n|$))/gm, '\n');

  tree.write(viteConfigPath, viteConfigContent);
}

function printOptions(...options: string[]): string {
  return options.filter(Boolean).join('\n');
}

function handleViteConfigFileExists(
  tree: Tree,
  viteConfigPath: string,
  options: ViteConfigFileOptions,
  buildOption: string,
  buildOutDir: string,
  imports: string[],
  plugins: string[],
  testOption: string,
  reportsDirectory: string,
  cacheDir: string,
  projectRoot: string,
  offsetFromRoot: string,
  projectAlreadyHasViteTargets?: TargetFlags
) {
  if (
    projectAlreadyHasViteTargets?.build &&
    projectAlreadyHasViteTargets?.test
  ) {
    return;
  }

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    logger.info(
      `vite.config.ts already exists for project ${options.project}.`
    );
  }

  const buildOptionObject = options.includeLib
    ? {
        lib: {
          entry: 'src/index.ts',
          name: options.project,
          fileName: 'index',
          formats: ['es'],
        },
        rollupOptions: {
          external: options.rollupOptionsExternal ?? [],
        },
        outDir: buildOutDir,
        reportCompressedSize: true,
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      }
    : {
        outDir: buildOutDir,
        reportCompressedSize: true,
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      };

  const testOptionObject = {
    globals: true,
    environment: options.testEnvironment ?? 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: reportsDirectory,
      provider: `'${options.coverageProvider ?? 'v8'}'`,
    },
  };

  const changed = ensureViteConfigIsCorrect(
    tree,
    viteConfigPath,
    buildOption,
    buildOptionObject,
    imports,
    plugins,
    testOption,
    testOptionObject,
    cacheDir,
    projectAlreadyHasViteTargets ?? {}
  );

  if (!changed) {
    logger.warn(
      `Make sure the following setting exists in your Vite configuration file (${viteConfigPath}):

        ${buildOption}

        `
    );
  }
}

function normalizedJoinPaths(...paths: string[]): string {
  const path = joinPathFragments(...paths);

  return path.startsWith('.') ? path : `./${path}`;
}
