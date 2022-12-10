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

export function findExistingTargets(targets: {
  [targetName: string]: TargetConfiguration;
}): {
  buildTarget?: string;
  serveTarget?: string;
  testTarget?: string;
  unsuppored?: boolean;
} {
  let buildTarget, serveTarget, testTarget, unsuppored;

  const arrayOfBuilders = [
    '@nxext/vite:build',
    '@nrwl/js:babel',
    '@nrwl/js:swc',
    '@nrwl/webpack:webpack',
    '@nrwl/rollup:rollup',
    '@nrwl/web:rollup',
  ];

  const arrayOfServers = ['@nxext/vite:dev', '@nrwl/webpack:dev-server'];

  const arrayOfTesters = ['@nrwl/jest:jest', '@nxext/vitest:vitest'];

  const arrayofUnsupported = [
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

  for (const target in targets) {
    if (buildTarget && serveTarget && testTarget) {
      break;
    }
    if (arrayOfBuilders.includes(targets[target].executor)) {
      buildTarget = target;
    }
    if (arrayOfServers.includes(targets[target].executor)) {
      serveTarget = target;
    }
    if (arrayOfTesters.includes(targets[target].executor)) {
      testTarget = target;
    }
    if (arrayofUnsupported.includes(targets[target].executor)) {
      unsuppored = true;
    }
  }

  return {
    buildTarget,
    serveTarget,
    testTarget,
    unsuppored,
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
    buildOptions.fileReplacements = targets[target].options.fileReplacements;

    if (target === '@nxext/vite:build') {
      buildOptions.base = targets[target].options.baseHref;
      buildOptions.sourcemap = targets[target].options.sourcemaps;
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
        development: {},
        production: {},
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
