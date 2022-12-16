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
} from '@nrwl/devkit';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import { VitestExecutorOptions } from '../executors/test/schema';
import { Schema } from '../generators/configuration/schema';

export interface UserProvidedTargetIsUnsupported {
  build?: boolean;
  serve?: boolean;
  test?: boolean;
}

export interface UserProvidedTargetName {
  build?: string;
  serve?: string;
  test?: string;
}

export interface ValidFoundTargetName {
  build?: string;
  serve?: string;
  test?: string;
}

export function findExistingTargetsInProject(
  targets: {
    [targetName: string]: TargetConfiguration;
  },
  userProvidedTargets?: UserProvidedTargetName
): {
  validFoundTargetName: ValidFoundTargetName;
  projectContainsUnsupportedExecutor?: boolean;
  userProvidedTargetIsUnsupported?: UserProvidedTargetIsUnsupported;
} {
  let validFoundBuildTarget: string | undefined,
    validFoundServeTarget: string | undefined,
    validFoundTestTarget: string | undefined,
    projectContainsUnsupportedExecutor: boolean | undefined,
    unsupportedUserProvidedTargetBuild: boolean | undefined,
    unsupportedUserProvidedTargetServe: boolean | undefined,
    unsupportedUserProvidedTargetTest: boolean | undefined;

  const arrayOfSupportedBuilders = [
    '@nxext/vite:build',
    '@nrwl/js:babel',
    '@nrwl/js:swc',
    '@nrwl/webpack:webpack',
    '@nrwl/rollup:rollup',
    '@nrwl/web:rollup',
  ];

  const arrayOfSupportedServers = [
    '@nxext/vite:dev',
    '@nrwl/webpack:dev-server',
  ];

  const arrayOfSupportedTesters = ['@nrwl/jest:jest', '@nxext/vitest:vitest'];

  const arrayofUnsupportedExecutors = [
    '@nrwl/angular:ng-packagr-lite',
    '@angular-devkit/build-angular:browser',
    '@nrwl/angular:package',
    '@nrwl/angular:webpack-browser',
    '@angular-devkit/build-angular:browser',
    '@angular-devkit/build-angular:dev-server',
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/esbuild:esbuild',
    '@nrwl/react-native:start',
    '@nrwl/next:build',
    '@nrwl/next:server',
    '@nrwl/js:tsc',
  ];

  // First, we check if the user has provided a target
  // If they have, we check if the executor the target is using is supported
  // If it's not supported, then we set the unsupported flag to true for that target

  if (userProvidedTargets?.build) {
    if (
      arrayOfSupportedBuilders.includes(
        targets[userProvidedTargets.build]?.executor
      )
    ) {
      validFoundBuildTarget = userProvidedTargets.build;
    } else {
      unsupportedUserProvidedTargetBuild = true;
    }
  }

  if (userProvidedTargets?.serve) {
    if (
      arrayOfSupportedServers.includes(
        targets[userProvidedTargets.serve]?.executor
      )
    ) {
      validFoundServeTarget = userProvidedTargets.serve;
    } else {
      unsupportedUserProvidedTargetServe = true;
    }
  }

  if (userProvidedTargets?.test) {
    if (
      arrayOfSupportedServers.includes(
        targets[userProvidedTargets.test]?.executor
      )
    ) {
      validFoundTestTarget = userProvidedTargets.test;
    } else {
      unsupportedUserProvidedTargetTest = true;
    }
  }

  // Then, we try to find the targets that are using the supported executors
  // for build, serve and test, since these are the ones we will be converting

  for (const target in targets) {
    // If we have a value for each one of the targets, we can break out of the loop
    if (
      validFoundBuildTarget &&
      validFoundServeTarget &&
      validFoundTestTarget
    ) {
      break;
    }
    if (
      !validFoundBuildTarget &&
      arrayOfSupportedBuilders.includes(targets[target].executor)
    ) {
      validFoundBuildTarget = target;
    }
    if (
      !validFoundServeTarget &&
      arrayOfSupportedServers.includes(targets[target].executor)
    ) {
      validFoundServeTarget = target;
    }
    if (
      !validFoundTestTarget &&
      arrayOfSupportedTesters.includes(targets[target].executor)
    ) {
      validFoundTestTarget = target;
    }
    if (arrayofUnsupportedExecutors.includes(targets[target].executor)) {
      projectContainsUnsupportedExecutor = true;
    }
  }

  return {
    validFoundTargetName: {
      build: validFoundBuildTarget,
      serve: validFoundServeTarget,
      test: validFoundTestTarget,
    },
    projectContainsUnsupportedExecutor,
    userProvidedTargetIsUnsupported: {
      build: unsupportedUserProvidedTargetBuild,
      serve: unsupportedUserProvidedTargetServe,
      test: unsupportedUserProvidedTargetTest,
    },
  };
}

export function addOrChangeTestTarget(
  tree: Tree,
  options: Schema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);
  const targets = {
    ...project.targets,
  };

  const testOptions: VitestExecutorOptions = {
    passWithNoTests: true,
  };

  if (targets[target]) {
    targets[target].executor = '@nrwl/vite:test';
    delete targets[target].options.jestConfig;
  } else {
    targets[target] = {
      executor: '@nrwl/vite:test',
      outputs: ['{projectRoot}/coverage'],
      options: testOptions,
    };
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...targets,
    },
  });
}

export function addOrChangeBuildTarget(
  tree: Tree,
  options: Schema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);

  const buildOptions: ViteBuildExecutorOptions = {
    outputPath: joinPathFragments(
      'dist',
      project.root != '.' ? project.root : options.project
    ),
  };

  const targets = {
    ...project.targets,
  };

  if (targets[target]) {
    buildOptions.fileReplacements = targets[target].options?.fileReplacements;

    if (targets[target].executor === '@nxext/vite:build') {
      buildOptions.base = targets[target].options?.baseHref;
      buildOptions.sourcemap = targets[target].options?.sourcemaps;
    }
    targets[target].options = {
      ...buildOptions,
    };
    targets[target].executor = '@nrwl/vite:build';
  } else {
    targets[`${target}`] = {
      executor: '@nrwl/vite:build',
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

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...targets,
    },
  });
}

export function addOrChangeServeTarget(
  tree: Tree,
  options: Schema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);

  const serveOptions: ViteDevServerExecutorOptions = {
    buildTarget: `${options.project}:build`,
  };

  const targets = {
    ...project.targets,
  };

  if (targets[target]) {
    if (target === '@nxext/vite:dev') {
      serveOptions.proxyConfig = targets[target].options.proxyConfig;
    }
    targets[target].options = {
      ...serveOptions,
    };
    targets[target].executor = '@nrwl/vite:dev-server';
  } else {
    targets[`${target}`] = {
      executor: '@nrwl/vite:dev-server',
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

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...targets,
    },
  });
}

export function editTsConfig(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const config = readJson(tree, `${projectConfig.root}/tsconfig.json`);

  switch (options.uiFramework) {
    case 'react':
      config.compilerOptions = {
        target: 'ESNext',
        useDefineForClassFields: true,
        lib: ['DOM', 'DOM.Iterable', 'ESNext'],
        allowJs: false,
        skipLibCheck: true,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: 'ESNext',
        moduleResolution: 'Node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        types: ['vite/client'],
      };
      config.include = [...config.include, 'src'];
      break;
    case 'none':
      config.compilerOptions = {
        target: 'ESNext',
        useDefineForClassFields: true,
        module: 'ESNext',
        lib: ['ESNext', 'DOM'],
        moduleResolution: 'Node',
        strict: true,
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        noEmit: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        skipLibCheck: true,
        types: ['vite/client'],
      };
      config.include = [...config.include, 'src'];
      break;
    default:
      break;
  }

  writeJson(tree, `${projectConfig.root}/tsconfig.json`, config);
}

export function moveAndEditIndexHtml(
  tree: Tree,
  options: Schema,
  buildTarget: string
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  let indexHtmlPath =
    projectConfig.targets[buildTarget].options?.index ??
    `${projectConfig.root}/src/index.html`;
  const mainPath = (
    projectConfig.targets[buildTarget].options?.main ??
    `${projectConfig.root}/src/main.ts${
      options.uiFramework === 'react' ? 'x' : ''
    }`
  ).replace(projectConfig.root, '');

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

      if (tree.exists(`${projectConfig.root}/src/index.html`))
        tree.delete(`${projectConfig.root}/src/index.html`);
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

export function writeViteConfig(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const viteConfigPath = `${projectConfig.root}/vite.config.ts`;

  if (tree.exists(viteConfigPath)) {
    // TODO (katerina): Ideally we should check if the config is already set up correctly
    logger.info(
      `vite.config.ts already exists. Skipping creation of vite config for ${options.project}.`
    );
    return;
  }

  let viteConfigContent = '';

  const testOption = options.includeVitest
    ? `test: {
    globals: true,
    cache: {
      dir: '${offsetFromRoot(projectConfig.root)}node_modules/.vitest'
    },
    environment: 'jsdom',
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

  const dtsPlugin = `dts({
      tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
      // Faster builds by skipping tests. Set this to false to enable type checking.
      skipDiagnostics: true,
    }),`;

  const buildOption = options.includeLib
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
            // Don't forgot to update your package.json as well.
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

  const serverOption = options.includeLib
    ? ''
    : `
    server:{
      port: 4200,
      host: 'localhost',
    },`;

  switch (options.uiFramework) {
    case 'react':
      viteConfigContent = `
${options.includeVitest ? '/// <reference types="vitest" />' : ''}
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import viteTsConfigPaths from 'vite-tsconfig-paths';
      ${
        options.includeLib
          ? `import dts from 'vite-plugin-dts';\nimport { join } from 'path';`
          : ''
      }
      
      export default defineConfig({
        ${serverOption}
        plugins: [
          ${options.includeLib ? dtsPlugin : ''}
          react(),
          viteTsConfigPaths({
            root: '${offsetFromRoot(projectConfig.root)}',
          }),
        ],
        ${buildOption}
        ${defineOption}
        ${testOption}
      });`;
      break;
    case 'none':
      viteConfigContent = `
      ${options.includeVitest ? '/// <reference types="vitest" />' : ''}
      import { defineConfig } from 'vite';
      import viteTsConfigPaths from 'vite-tsconfig-paths';
      ${
        options.includeLib
          ? `import dts from 'vite-plugin-dts';\nimport { join } from 'path';`
          : ''
      }
      
      export default defineConfig({
        ${serverOption}
        plugins: [
          ${options.includeLib ? dtsPlugin : ''}
          viteTsConfigPaths({
            root: '${offsetFromRoot(projectConfig.root)}',
          }),
        ],
        ${buildOption}
        ${defineOption}
        ${testOption}
      });`;
      break;
    default:
      break;
  }

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
    viteConfigPath = targets[target]?.options?.configFile;
  } else {
    const buildTarget = Object.entries(targets).find(
      ([_targetName, targetConfig]) => {
        return targetConfig.executor === '@nrwl/vite:build';
      }
    );
    viteConfigPath = buildTarget?.[1]?.options?.configFile;
  }

  return normalizeViteConfigFilePathWithTree(tree, root, viteConfigPath);
}

export async function handleUnsupportedUserProvidedTargets(
  userProvidedTargetIsUnsupported: UserProvidedTargetIsUnsupported,
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
  action: 'build' | 'serve' | 'test',
  executor: 'build' | 'dev-server' | 'test'
) {
  logger.warn(
    `The custom ${action} target you provided (${userProvidedTargetName}) cannot be converted to use the @nrwl/vite:${executor} executor.
     However, we found the following ${action} target in your project that can be converted: ${validFoundTargetName}

     Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
     your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
    `
  );
  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should we convert the ${validFoundTargetName} target to use the @nrwl/vite:${executor} executor?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(
      `The ${action} target ${userProvidedTargetName} cannot be converted to use the @nrwl/vite:${executor} executor.
      Please try again, either by providing a different ${action} target or by not providing a target at all (Nx will
        convert the first one it finds, most probably this one: ${validFoundTargetName})

      Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
      your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
      `
    );
  }
}

export async function handleUnknownExecutors() {
  logger.warn(
    `
      We cound not find any targets in your project that are using the supported executors for build, serve and test.
      However, we could not verify that the executors you are using are not supported.
      Please make sure to commit your changes before running this generator.
      `
  );

  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should Nx convert your project to use the @nrwl/vite executors?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(`
      Nx could not verify that the executors you are using can be converted to the @nrwl/vite executors.
      Please try again with a different project.
    `);
  }
}
