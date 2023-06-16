import {
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import { VitePreviewServerExecutorOptions } from '../executors/preview-server/schema';
import { VitestExecutorOptions } from '../executors/test/schema';
import { ViteConfigurationGeneratorSchema } from '../generators/configuration/schema';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';

export type Target = 'build' | 'serve' | 'test' | 'preview';
export type TargetFlags = Partial<Record<Target, boolean>>;
export type UserProvidedTargetName = Partial<Record<Target, string>>;
export type ValidFoundTargetName = Partial<Record<Target, string>>;

export function findExistingTargetsInProject(
  targets: {
    [targetName: string]: TargetConfiguration;
  },
  userProvidedTargets?: UserProvidedTargetName
): {
  validFoundTargetName: ValidFoundTargetName;
  projectContainsUnsupportedExecutor: boolean;
  userProvidedTargetIsUnsupported: TargetFlags;
  alreadyHasNxViteTargets: TargetFlags;
} {
  const output: ReturnType<typeof findExistingTargetsInProject> = {
    validFoundTargetName: {},
    projectContainsUnsupportedExecutor: false,
    userProvidedTargetIsUnsupported: {},
    alreadyHasNxViteTargets: {},
  };

  const supportedExecutors = {
    build: [
      '@nxext/vite:build',
      '@nx/js:babel',
      '@nx/js:swc',
      '@nx/webpack:webpack',
      '@nx/rollup:rollup',
      '@nrwl/js:babel',
      '@nrwl/js:swc',
      '@nrwl/webpack:webpack',
      '@nrwl/rollup:rollup',
      '@nrwl/web:rollup',
    ],
    serve: [
      '@nxext/vite:dev',
      '@nx/webpack:dev-server',
      '@nrwl/webpack:dev-server',
    ],
    test: ['@nx/jest:jest', '@nrwl/jest:jest', '@nxext/vitest:vitest'],
  };

  const unsupportedExecutors = [
    '@nx/angular:ng-packagr-lite',
    '@nx/angular:package',
    '@nx/angular:webpack-browser',
    '@nx/esbuild:esbuild',
    '@nx/react-native:run-ios',
    '@nx/react-native:start',
    '@nx/react-native:run-android',
    '@nx/react-native:bundle',
    '@nx/react-native:build-android',
    '@nx/react-native:bundle',
    '@nx/next:build',
    '@nx/next:server',
    '@nx/js:tsc',
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/angular:package',
    '@nrwl/angular:webpack-browser',
    '@nrwl/esbuild:esbuild',
    '@nrwl/react-native:run-ios',
    '@nrwl/react-native:start',
    '@nrwl/react-native:run-android',
    '@nrwl/react-native:bundle',
    '@nrwl/react-native:build-android',
    '@nrwl/react-native:bundle',
    '@nrwl/next:build',
    '@nrwl/next:server',
    '@nrwl/js:tsc',
    '@angular-devkit/build-angular:browser',
    '@angular-devkit/build-angular:dev-server',
  ];

  // First, we check if the user has provided a target
  // If they have, we check if the executor the target is using is supported
  // If it's not supported, then we set the unsupported flag to true for that target

  function checkUserProvidedTarget(target: Target) {
    if (userProvidedTargets?.[target]) {
      if (
        supportedExecutors[target].includes(
          targets[userProvidedTargets[target]]?.executor
        )
      ) {
        output.validFoundTargetName[target] = userProvidedTargets[target];
      } else {
        output.userProvidedTargetIsUnsupported[target] = true;
      }
    }
  }

  checkUserProvidedTarget('build');
  checkUserProvidedTarget('serve');
  checkUserProvidedTarget('test');

  // Returns early when we have a build, serve, and test targets.
  if (
    output.validFoundTargetName.build &&
    output.validFoundTargetName.serve &&
    output.validFoundTargetName.test
  ) {
    return output;
  }

  // We try to find the targets that are using the supported executors
  // for build, serve and test, since these are the ones we will be converting
  for (const target in targets) {
    const executorName = targets[target].executor;

    const hasViteTargets = output.alreadyHasNxViteTargets;
    hasViteTargets.build ||=
      executorName === '@nx/vite:build' || executorName === '@nrwl/vite:build';
    hasViteTargets.serve ||=
      executorName === '@nx/vite:dev-server' ||
      executorName === '@nrwl/vite:dev-server';
    hasViteTargets.test ||=
      executorName === '@nx/vite:test' || executorName === '@nrwl/vite:test';
    hasViteTargets.preview ||=
      executorName === '@nx/vite:preview-server' ||
      executorName === '@nrwl/vite:preview-server';

    const foundTargets = output.validFoundTargetName;
    if (
      !foundTargets.build &&
      supportedExecutors.build.includes(executorName)
    ) {
      foundTargets.build = target;
    }
    if (
      !foundTargets.serve &&
      supportedExecutors.serve.includes(executorName)
    ) {
      foundTargets.serve = target;
    }
    if (!foundTargets.test && supportedExecutors.test.includes(executorName)) {
      foundTargets.test = target;
    }

    output.projectContainsUnsupportedExecutor ||=
      unsupportedExecutors.includes(executorName);
  }

  return output;
}

export function addOrChangeTestTarget(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);

  const coveragePath = joinPathFragments(
    'coverage',
    project.root === '.' ? options.project : project.root
  );
  const testOptions: VitestExecutorOptions = {
    passWithNoTests: true,
    // vitest runs in the project root so we have to offset to the workspaceRoot
    reportsDirectory: joinPathFragments(
      offsetFromRoot(project.root),
      coveragePath
    ),
  };

  project.targets ??= {};

  if (project.targets[target]) {
    project.targets[target].executor = '@nx/vite:test';
    delete project.targets[target].options?.jestConfig;
  } else {
    project.targets[target] = {
      executor: '@nx/vite:test',
      outputs: [coveragePath],
      options: testOptions,
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

export function addOrChangeBuildTarget(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);
  const buildOptions: ViteBuildExecutorOptions = {
    outputPath: joinPathFragments(
      'dist',
      project.root != '.' ? project.root : options.project
    ),
  };

  project.targets ??= {};

  if (project.targets[target]) {
    buildOptions.fileReplacements =
      project.targets[target].options?.fileReplacements;

    if (project.targets[target].executor === '@nxext/vite:build') {
      buildOptions.base = project.targets[target].options?.baseHref;
      buildOptions.sourcemap = project.targets[target].options?.sourcemaps;
    }
    project.targets[target].options = { ...buildOptions };
    project.targets[target].executor = '@nx/vite:build';
  } else {
    project.targets[target] = {
      executor: '@nx/vite:build',
      outputs: ['{options.outputPath}'],
      defaultConfiguration: 'production',
      options: buildOptions,
      configurations: {
        development: {
          mode: 'development',
        },
        production: {
          mode: 'production',
        },
      },
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

export function addOrChangeServeTarget(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);

  project.targets ??= {};

  if (project.targets[target]) {
    const serveTarget = project.targets[target];
    const serveOptions: ViteDevServerExecutorOptions = {
      buildTarget: `${options.project}:build`,
      https: project.targets[target].options?.https,
      hmr: project.targets[target].options?.hmr,
      open: project.targets[target].options?.open,
    };
    if (serveTarget.executor === '@nxext/vite:dev') {
      serveOptions.proxyConfig = project.targets[target].options.proxyConfig;
    }
    serveTarget.executor = '@nx/vite:dev-server';
    serveTarget.options = serveOptions;
  } else {
    project.targets[target] = {
      executor: '@nx/vite:dev-server',
      defaultConfiguration: 'development',
      options: {
        buildTarget: `${options.project}:build`,
      },
      configurations: {
        development: {
          buildTarget: `${options.project}:build:development`,
          hmr: true,
        },
        production: {
          buildTarget: `${options.project}:build:production`,
          hmr: false,
        },
      },
    };
  }

  updateProjectConfiguration(tree, options.project, project);
}

/**
 * Adds a target for the preview server.
 *
 * @param tree
 * @param options
 * @param serveTarget An existing serve target.
 * @param previewTarget  The preview target to create.
 */
export function addPreviewTarget(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  serveTarget: string
) {
  const project = readProjectConfiguration(tree, options.project);

  const previewOptions: VitePreviewServerExecutorOptions = {
    buildTarget: `${options.project}:build`,
  };

  project.targets ??= {};

  // Update the options from the passed serve target.
  if (project.targets[serveTarget]) {
    const target = project.targets[serveTarget];
    if (target.executor === '@nxext/vite:dev') {
      previewOptions.proxyConfig = target.options.proxyConfig;
    }
    previewOptions.https = target.options?.https;
    previewOptions.open = target.options?.open;
  }

  // Adds a preview target.
  project.targets.preview = {
    executor: '@nx/vite:preview-server',
    defaultConfiguration: 'development',
    options: previewOptions,
    configurations: {
      development: {
        buildTarget: `${options.project}:build:development`,
      },
      production: {
        buildTarget: `${options.project}:build:production`,
      },
    },
  };

  updateProjectConfiguration(tree, options.project, project);
}

export function editTsConfig(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const config = readJson(tree, `${projectConfig.root}/tsconfig.json`);

  const commonCompilerOptions = {
    target: 'ESNext',
    useDefineForClassFields: true,
    module: 'ESNext',
    strict: true,
    moduleResolution: 'Node',
    resolveJsonModule: true,
    isolatedModules: true,
    types: ['vite/client'],
    noEmit: true,
  };

  switch (options.uiFramework) {
    case 'react':
      config.compilerOptions = {
        ...commonCompilerOptions,
        lib: ['DOM', 'DOM.Iterable', 'ESNext'],
        allowJs: false,
        esModuleInterop: false,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        jsx: 'react-jsx',
      };
      config.include = [...config.include, 'src'];
      break;
    case 'none':
      config.compilerOptions = {
        ...commonCompilerOptions,
        lib: ['ESNext', 'DOM'],
        skipLibCheck: true,
        esModuleInterop: true,
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
      };
      config.include = [...config.include, 'src'];
      break;
    default:
      break;
  }

  writeJson(tree, `${projectConfig.root}/tsconfig.json`, config);
}

export function deleteWebpackConfig(
  tree: Tree,
  projectRoot: string,
  webpackConfigFilePath?: string
) {
  const webpackConfigPath =
    webpackConfigFilePath && tree.exists(webpackConfigFilePath)
      ? webpackConfigFilePath
      : tree.exists(`${projectRoot}/webpack.config.js`)
      ? `${projectRoot}/webpack.config.js`
      : tree.exists(`${projectRoot}/webpack.config.ts`)
      ? `${projectRoot}/webpack.config.ts`
      : null;
  if (webpackConfigPath) {
    tree.delete(webpackConfigPath);
  }
}

export function moveAndEditIndexHtml(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  buildTarget: string
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  let indexHtmlPath =
    projectConfig.targets?.[buildTarget]?.options?.index ??
    `${projectConfig.root}/src/index.html`;
  let mainPath =
    projectConfig.targets?.[buildTarget]?.options?.main ??
    `${projectConfig.root}/src/main.ts${
      options.uiFramework === 'react' ? 'x' : ''
    }`;

  if (projectConfig.root !== '.') {
    mainPath = mainPath.replace(projectConfig.root, '');
  }

  if (
    !tree.exists(indexHtmlPath) &&
    tree.exists(`${projectConfig.root}/index.html`)
  ) {
    indexHtmlPath = `${projectConfig.root}/index.html`;
  }

  if (tree.exists(indexHtmlPath)) {
    const indexHtmlContent = tree.read(indexHtmlPath, 'utf8');
    if (
      !indexHtmlContent.includes(
        `<script type="module" src="${mainPath}"></script>`
      )
    ) {
      tree.write(
        `${projectConfig.root}/index.html`,
        indexHtmlContent.replace(
          '</body>',
          `<script type="module" src="${mainPath}"></script>
          </body>`
        )
      );

      if (tree.exists(`${projectConfig.root}/src/index.html`)) {
        tree.delete(`${projectConfig.root}/src/index.html`);
      }
    }
  } else {
    tree.write(
      `${projectConfig.root}/index.html`,
      `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Vite</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="${mainPath}"></script>
        </body>
      </html>`
    );
  }
}

export function createOrEditViteConfig(
  tree: Tree,
  options: ViteConfigurationGeneratorSchema,
  onlyVitest: boolean,
  projectAlreadyHasViteTargets?: TargetFlags
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const viteConfigPath = `${projectConfig.root}/vite.config.ts`;

  const buildOption = onlyVitest
    ? ''
    : options.includeLib
    ? `
      // Configuration for building your library.
      // See: https://vitejs.dev/guide/build.html#library-mode
      build: {
        lib: {
          // Could also be a dictionary or array of multiple entry points.
          entry: 'src/index.ts',
          name: '${options.project}',
          fileName: 'index',
          // Change this to the formats you want to support.
          // Don't forget to update your package.json as well.
          formats: ['es', 'cjs']
        },
        rollupOptions: {
          // External packages that should not be bundled into your library.
          external: [${
            options.uiFramework === 'react'
              ? "'react', 'react-dom', 'react/jsx-runtime'"
              : ''
          }]
        }
      },`
    : ``;

  const dtsPlugin = onlyVitest
    ? ''
    : options.includeLib
    ? `dts({
      entryRoot: 'src',
      tsConfigFilePath: path.join(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),`
    : '';

  const dtsImportLine = onlyVitest
    ? ''
    : options.includeLib
    ? `import dts from 'vite-plugin-dts';\nimport * as path from 'path';`
    : '';

  let viteConfigContent = '';

  const testOption = options.includeVitest
    ? `test: {
    globals: true,
    cache: {
      dir: '${offsetFromRoot(projectConfig.root)}node_modules/.vitest'
    },
    environment: '${options.testEnvironment ?? 'jsdom'}',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    ${
      options.inSourceTests
        ? `includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']`
        : ''
    }
  },`
    : '';

  const defineOption = options.inSourceTests
    ? `define: {
    'import.meta.vitest': undefined
  },`
    : '';

  const reactPluginImportLine =
    options.uiFramework === 'react'
      ? options.compiler === 'swc'
        ? `import react from '@vitejs/plugin-react-swc';`
        : `import react from '@vitejs/plugin-react';`
      : '';

  const reactPlugin = options.uiFramework === 'react' ? `react(),` : '';

  const devServerOption = onlyVitest
    ? ''
    : options.includeLib
    ? ''
    : `
    server:{
      port: 4200,
      host: 'localhost',
    },`;

  const previewServerOption = onlyVitest
    ? ''
    : options.includeLib
    ? ''
    : `
    preview:{
      port: 4300,
      host: 'localhost',
    },`;

  const pluginOption = `
    plugins: [
      ${dtsPlugin}
      ${reactPlugin}
      viteTsConfigPaths({
        root: '${offsetFromRoot(projectConfig.root)}',
      }),
    ],
    `;

  const workerOption = `
    // Uncomment this if you are using workers. 
    // worker: {
    //  plugins: [
    //    viteTsConfigPaths({
    //      root: '${offsetFromRoot(projectConfig.root)}',
    //    }),
    //  ],
    // },`;

  const cacheDir = `cacheDir: '${offsetFromRoot(
    projectConfig.root
  )}node_modules/.vite/${options.project}',`;

  if (tree.exists(viteConfigPath)) {
    handleViteConfigFileExists(
      tree,
      viteConfigPath,
      options,
      buildOption,
      dtsPlugin,
      dtsImportLine,
      pluginOption,
      testOption,
      cacheDir,
      offsetFromRoot(projectConfig.root),
      projectAlreadyHasViteTargets
    );
    return;
  }

  viteConfigContent = `
      /// <reference types="vitest" />
      import { defineConfig } from 'vite';
      ${reactPluginImportLine}
      import viteTsConfigPaths from 'vite-tsconfig-paths';
      ${dtsImportLine}
      
      export default defineConfig({
        ${cacheDir}
        ${devServerOption}
        ${previewServerOption}
        ${pluginOption}
        ${workerOption}
        ${buildOption}
        ${defineOption}
        ${testOption}
      });`;

  tree.write(viteConfigPath, viteConfigContent);
}

export function normalizeViteConfigFilePathWithTree(
  tree: Tree,
  projectRoot: string,
  configFile?: string
): string {
  return configFile && tree.exists(configFile)
    ? configFile
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}

export function getViteConfigPathForProject(
  tree: Tree,
  projectName: string,
  target?: string
) {
  let viteConfigPath: string | undefined;
  const { targets, root } = readProjectConfiguration(tree, projectName);
  if (target) {
    viteConfigPath = targets?.[target]?.options?.configFile;
  } else {
    const config = Object.values(targets).find(
      (config) =>
        config.executor === '@nrwl/nx:build' ||
        config.executor === '@nrwl/vite:build'
    );
    viteConfigPath = config?.options?.configFile;
  }

  return normalizeViteConfigFilePathWithTree(tree, root, viteConfigPath);
}

export async function handleUnsupportedUserProvidedTargets(
  userProvidedTargetIsUnsupported: TargetFlags,
  userProvidedTargetName: UserProvidedTargetName,
  validFoundTargetName: ValidFoundTargetName
) {
  if (userProvidedTargetIsUnsupported.build && validFoundTargetName.build) {
    await handleUnsupportedUserProvidedTargetsErrors(
      userProvidedTargetName.build,
      validFoundTargetName.build,
      'build',
      'build'
    );
  }

  if (userProvidedTargetIsUnsupported.serve && validFoundTargetName.serve) {
    await handleUnsupportedUserProvidedTargetsErrors(
      userProvidedTargetName.serve,
      validFoundTargetName.serve,
      'serve',
      'dev-server'
    );
  }

  if (userProvidedTargetIsUnsupported.test && validFoundTargetName.test) {
    await handleUnsupportedUserProvidedTargetsErrors(
      userProvidedTargetName.test,
      validFoundTargetName.test,
      'test',
      'test'
    );
  }
}

async function handleUnsupportedUserProvidedTargetsErrors(
  userProvidedTargetName: string,
  validFoundTargetName: string,
  target: Target,
  executor: 'build' | 'dev-server' | 'test'
) {
  logger.warn(
    `The custom ${target} target you provided (${userProvidedTargetName}) cannot be converted to use the @nx/vite:${executor} executor.
     However, we found the following ${target} target in your project that can be converted: ${validFoundTargetName}

     Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
     your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
    `
  );
  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should we convert the ${validFoundTargetName} target to use the @nx/vite:${executor} executor?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(
      `The ${target} target ${userProvidedTargetName} cannot be converted to use the @nx/vite:${executor} executor.
      Please try again, either by providing a different ${target} target or by not providing a target at all (Nx will
        convert the first one it finds, most probably this one: ${validFoundTargetName})

      Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
      your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
      `
    );
  }
}

export async function handleUnknownExecutors(projectName: string) {
  logger.warn(
    `
      We could not find any targets in project ${projectName} that use executors which 
      can be converted to the @nx/vite executors.

      This either means that your project may not have a target 
      for building, serving, or testing at all, or that your targets are 
      using executors that are not known to Nx.
      
      If you still want to convert your project to use the @nx/vite executors,
      please make sure to commit your changes before running this generator.
      `
  );

  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should Nx convert your project to use the @nx/vite executors?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(`
      Nx could not verify that the executors you are using can be converted to the @nx/vite executors.
      Please try again with a different project.
    `);
  }
}

function handleViteConfigFileExists(
  tree: Tree,
  viteConfigPath: string,
  options: ViteConfigurationGeneratorSchema,
  buildOption: string,
  dtsPlugin: string,
  dtsImportLine: string,
  pluginOption: string,
  testOption: string,
  cacheDir: string,
  offsetFromRoot: string,
  projectAlreadyHasViteTargets?: TargetFlags
) {
  if (projectAlreadyHasViteTargets.build && projectAlreadyHasViteTargets.test) {
    return;
  }

  logger.info(`vite.config.ts already exists for project ${options.project}.`);
  const buildOptionObject = {
    lib: {
      entry: 'src/index.ts',
      name: options.project,
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external:
        options.uiFramework === 'react'
          ? ['react', 'react-dom', 'react/jsx-runtime']
          : [],
    },
  };

  const testOptionObject = {
    globals: true,
    cache: {
      dir: `${offsetFromRoot}node_modules/.vitest`,
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  };

  const changed = ensureViteConfigIsCorrect(
    tree,
    viteConfigPath,
    buildOption,
    buildOptionObject,
    dtsPlugin,
    dtsImportLine,
    pluginOption,
    testOption,
    testOptionObject,
    cacheDir,
    projectAlreadyHasViteTargets
  );

  if (!changed) {
    logger.warn(
      `Make sure the following setting exists in your Vite configuration file (${viteConfigPath}):
        
        ${buildOption}
        
        `
    );
  } else {
    logger.info(`
      Vite configuration file (${viteConfigPath}) has been updated with the required settings for the new target(s).
      `);
  }
}
