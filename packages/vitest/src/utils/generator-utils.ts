import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  readNxJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { VitestExecutorOptions } from '../executors/test/schema';
import type { VitestPluginOptions } from '../plugins/plugin';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';
import { warnVitestExecutorGenerating } from './deprecation';
import { nxVersion } from './versions';

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
  const target = options.testTarget ?? 'test';

  // The plugin only infers the target names it is registered for, so a request
  // for any other name still needs an explicit target.
  hasPlugin ||=
    nxJson.plugins?.some((p) => {
      if (typeof p === 'string') {
        return p === '@nx/vitest' && target === 'test';
      }
      if (p.plugin !== '@nx/vitest') {
        return false;
      }
      const pluginOptions = p.options as VitestPluginOptions;
      return (
        (pluginOptions?.testTargetName ?? 'test') === target ||
        pluginOptions?.ciTargetName === target
      );
    }) ?? false;

  if (hasPlugin) {
    return;
  }

  const project = readProjectConfiguration(tree, options.project);

  const reportsDirectory = joinPathFragments(
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
    warnVitestExecutorGenerating();
    project.targets[target] = {
      executor: '@nx/vitest:test',
      outputs: ['{options.reportsDirectory}'],
      options: testOptions,
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

// Escape a value for emission inside a single-quoted source literal.
function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export interface ViteConfigFileOptions {
  project: string;
  includeLib?: boolean;
  includeVitest?: boolean;
  inSourceTests?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  testInclude?: string[];
  /**
   * Aliases to emit under `resolve.alias`, as alias -> project-relative path.
   * Only applies when a new config file is written; an existing config is left
   * untouched.
   */
  resolveAlias?: Record<string, string>;
  rolldownOptionsExternal?: string[];
  imports?: string[];
  plugins?: string[];
  coverageProvider?: 'v8' | 'istanbul' | 'custom' | 'none';
  passWithNoTests?: boolean;
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
    skipNxPlugins?: boolean;
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
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      external: [${options.rolldownOptionsExternal ?? ''}]
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

  if (!isTsSolutionSetup && !extraOptions.skipNxPlugins) {
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
      `dts({ entryRoot: 'src', tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')${
        !isTsSolutionSetup ? ', pathsToAliases: false' : ''
      } })`
    );
  }

  const reportsDirectory = isTsSolutionSetup
    ? './test-output/vitest/coverage'
    : projectRoot === '.'
      ? `./coverage/${options.project}`
      : `${offsetFromRoot(projectRoot)}coverage/${projectRoot}`;

  const testInclude = options.testInclude ?? [
    '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  ];

  const testOption = options.includeVitest
    ? `  test: {
    name: '${options.project}',
    watch: false,
    globals: true,
    environment: '${options.testEnvironment ?? 'jsdom'}',
    include: [${testInclude
      .map((pattern) => `'${escapeLiteral(pattern)}'`)
      .join(', ')}],
${options.passWithNoTests ? `    passWithNoTests: true,\n` : ''}\
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

  const aliasEntries = Object.entries(options.resolveAlias ?? {});
  const resolveOption = aliasEntries.length
    ? `  resolve: {
    alias: {
${aliasEntries
  .map(
    ([alias, target]) =>
      `      '${escapeLiteral(alias)}': join(import.meta.dirname, '${escapeLiteral(target)}'),`
  )
  .join('\n')}
    },
  },`
    : '';

  const cacheDir = `cacheDir: '${normalizedJoinPaths(
    offsetFromRoot(projectRoot),
    'node_modules',
    '.vite',
    projectRoot === '.' ? options.project : projectRoot
  )}',`;

  if (tree.exists(viteConfigPath)) {
    if (aliasEntries.length) {
      logger.warn(
        `${viteConfigPath} already exists; the requested resolve.alias entries were not added to it.`
      );
    }
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

  if (aliasEntries.length) {
    imports.push(`import { join } from 'node:path'`);
  }

  const viteConfigContent = extraOptions.vitestFileName
    ? `import { defineConfig } from 'vitest/config';
${imports.join(';\n')}${imports.length ? ';' : ''}

export default defineConfig(() => ({
  root: import.meta.dirname,
  ${printOptions(
    cacheDir,
    plugins.length ? `  plugins: [${plugins.join(', ')}],` : '',
    resolveOption,
    defineOption,
    testOption
  )}
}));
`.replace(/\s+(?=(\n|$))/gm, '\n')
    : `/// <reference types='vitest' />
import { defineConfig } from 'vite';
${imports.join(';\n')}${imports.length ? ';' : ''}

export default defineConfig(() => ({
  root: import.meta.dirname,
  ${printOptions(
    cacheDir,
    devServerOption,
    previewServerOption,
    `  plugins: [${plugins.join(', ')}],`,
    resolveOption,
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
        rolldownOptions: {
          external: options.rolldownOptionsExternal ?? [],
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
    include: options.testInclude ?? [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    ...(options.passWithNoTests ? { passWithNoTests: true } : {}),
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
