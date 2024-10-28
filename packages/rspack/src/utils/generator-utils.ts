import {
  joinPathFragments,
  logger,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { RspackExecutorSchema } from '../executors/rspack/schema';
import { ConfigurationSchema } from '../generators/configuration/schema';
import { Framework } from '../generators/init/schema';

export type Target = 'build' | 'serve';
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
  alreadyHasNxRspackTargets: TargetFlags;
} {
  const output: ReturnType<typeof findExistingTargetsInProject> = {
    validFoundTargetName: {},
    projectContainsUnsupportedExecutor: false,
    userProvidedTargetIsUnsupported: {},
    alreadyHasNxRspackTargets: {},
  };

  const supportedExecutors = {
    build: [
      '@nxext/vite:build',
      '@nrwl/webpack:webpack',
      '@nrwl/rollup:rollup',
      '@nrwl/web:rollup',
      '@nrwl/vite:build',
      '@nx/webpack:webpack',
      '@nx/rollup:rollup',
      '@nx/web:rollup',
      '@nx/vite:build',
    ],
    serve: [
      '@nxext/vite:dev',
      '@nrwl/webpack:dev-server',
      '@nrwl/vite:dev-server',
      '@nx/webpack:dev-server',
      '@nx/vite:dev-server',
    ],
  };

  const unsupportedExecutors = [
    '@nx/js:babel',
    '@nx/js:node',
    '@nx/js:swc',
    '@nx/react-native:run-ios',
    '@nx/react-native:start',
    '@nx/react-native:run-android',
    '@nx/react-native:bundle',
    '@nx/react-native:build-android',
    '@nx/react-native:bundle',
    '@nx/next:build',
    '@nx/next:server',
    '@nx/js:tsc',
    '@nx/angular:ng-packagr-lite',
    '@nx/angular:package',
    '@nx/angular:webpack-browser',
    '@nx/esbuild:esbuild',
    '@nrwl/js:babel',
    '@nrwl/js:node',
    '@nrwl/js:swc',
    '@nrwl/react-native:run-ios',
    '@nrwl/react-native:start',
    '@nrwl/react-native:run-android',
    '@nrwl/react-native:bundle',
    '@nrwl/react-native:build-android',
    '@nrwl/react-native:bundle',
    '@nrwl/next:build',
    '@nrwl/next:server',
    '@nrwl/js:tsc',
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/angular:package',
    '@nrwl/angular:webpack-browser',
    '@nrwl/esbuild:esbuild',
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

  // Returns early when we have a build, serve, and test targets.
  if (output.validFoundTargetName.build && output.validFoundTargetName.serve) {
    return output;
  }

  // We try to find the targets that are using the supported executors
  // for build, serve and test, since these are the ones we will be converting
  for (const target in targets) {
    const executorName = targets[target].executor;

    const hasRspackTargets = output.alreadyHasNxRspackTargets;
    hasRspackTargets.build ||= executorName === '@nx/rspack:rspack';
    hasRspackTargets.serve ||= executorName === '@nx/rspack:dev-server';

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

    output.projectContainsUnsupportedExecutor ||=
      unsupportedExecutors.includes(executorName);
  }

  return output;
}

export function addOrChangeBuildTarget(
  tree: Tree,
  options: ConfigurationSchema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);
  const assets = [];
  if (
    options.target === 'web' &&
    tree.exists(joinPathFragments(project.root, 'src/favicon.ico'))
  ) {
    assets.push(joinPathFragments(project.root, 'src/favicon.ico'));
  }
  if (tree.exists(joinPathFragments(project.root, 'src/assets'))) {
    assets.push(joinPathFragments(project.root, 'src/assets'));
  }

  const buildOptions: RspackExecutorSchema = {
    target: options.target ?? 'web',
    outputPath: joinPathFragments(
      'dist',
      // If standalone project then use the project's name in dist.
      project.root === '.' ? project.name : project.root
    ),
    main: determineMain(tree, options),
    tsConfig: determineTsConfig(tree, options),
    rspackConfig: joinPathFragments(project.root, 'rspack.config.js'),
    assets,
  };

  project.targets ??= {};

  project.targets[target] = {
    executor: '@nx/rspack:rspack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: buildOptions,
    configurations: {
      development: {
        mode: 'development',
      },
      production: {
        mode: 'production',
        optimization: options.target === 'web' ? true : undefined,
        sourceMap: false,
      },
    },
  };

  updateProjectConfiguration(tree, options.project, project);
}

export function addOrChangeServeTarget(
  tree: Tree,
  options: ConfigurationSchema,
  target: string
) {
  const project = readProjectConfiguration(tree, options.project);

  project.targets ??= {};

  project.targets[target] = {
    executor: '@nx/rspack:dev-server',
    options: {
      buildTarget: `${options.project}:build:development`,
    },
    configurations: {
      development: {},
      production: {
        buildTarget: `${options.project}:build:production`,
      },
    },
  };

  updateProjectConfiguration(tree, options.project, project);
}

export function writeRspackConfigFile(
  tree: Tree,
  options: ConfigurationSchema,
  stylePreprocessorOptions?: { includePaths?: string[] }
) {
  const project = readProjectConfiguration(tree, options.project);

  tree.write(
    joinPathFragments(project.root, 'rspack.config.js'),
    createConfig(options, stylePreprocessorOptions)
  );
}

function createConfig(
  options: ConfigurationSchema,
  stylePreprocessorOptions?: { includePaths?: string[] }
) {
  if (options.framework === 'react') {
    return `
      const { composePlugins, withNx, withReact } = require('@nx/rspack');

      module.exports = composePlugins(withNx(), withReact(${
        stylePreprocessorOptions
          ? `
        {
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        }
        `
          : ''
      }), (config) => {
        return config;
      });
    `;
  } else if (options.framework === 'web' || options.target === 'web') {
    return `
      const { composePlugins, withNx, withWeb } = require('@nx/rspack');

      module.exports = composePlugins(withNx(), withWeb(${
        stylePreprocessorOptions
          ? `
        {
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        }
        `
          : ''
      }), (config) => {
        return config;
      });
    `;
  } else if (options.framework === 'nest') {
    return `
    const { composePlugins, withNx } = require('@nx/rspack');

    module.exports = composePlugins(withNx(), (config) => {
      return config;
    });
    `;
  } else {
    return `
      const { composePlugins, withNx${
        stylePreprocessorOptions ? ', withWeb' : ''
      } } = require('@nx/rspack');

      module.exports = composePlugins(withNx()${
        stylePreprocessorOptions
          ? `,
        withWeb({
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        })`
          : ''
      }, (config) => {
        return config;
      });
    `;
  }
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

// Maybe add delete vite config?

export function moveAndEditIndexHtml(
  tree: Tree,
  options: ConfigurationSchema,
  buildTarget: string
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  let indexHtmlPath =
    projectConfig.targets?.[buildTarget]?.options?.index ??
    `${projectConfig.root}/src/index.html`;
  let mainPath =
    projectConfig.targets?.[buildTarget]?.options?.main ??
    `${projectConfig.root}/src/main.ts${
      options.framework === 'react' ? 'x' : ''
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

export function normalizeViteConfigFilePathWithTree(
  tree: Tree,
  projectRoot: string,
  configFile?: string
): string {
  return configFile && tree.exists(configFile)
    ? configFile
    : tree.exists(joinPathFragments(`${projectRoot}/rspack.config.ts`))
    ? joinPathFragments(`${projectRoot}/rspack.config.ts`)
    : tree.exists(joinPathFragments(`${projectRoot}/rspack.config.js`))
    ? joinPathFragments(`${projectRoot}/rspack.config.js`)
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
      (config) => config.executor === '@nx/rspack:build'
    );
    viteConfigPath = config?.options?.configFile;
  }

  return normalizeViteConfigFilePathWithTree(tree, root, viteConfigPath);
}

export async function handleUnsupportedUserProvidedTargets(
  userProvidedTargetIsUnsupported: TargetFlags,
  userProvidedTargetName: UserProvidedTargetName,
  validFoundTargetName: ValidFoundTargetName,
  framework: Framework
) {
  if (userProvidedTargetIsUnsupported.build && validFoundTargetName.build) {
    await handleUnsupportedUserProvidedTargetsErrors(
      userProvidedTargetName.build,
      validFoundTargetName.build,
      'build',
      'rspack'
    );
  }

  if (
    framework !== 'nest' &&
    userProvidedTargetIsUnsupported.serve &&
    validFoundTargetName.serve
  ) {
    await handleUnsupportedUserProvidedTargetsErrors(
      userProvidedTargetName.serve,
      validFoundTargetName.serve,
      'serve',
      'dev-server'
    );
  }
}

async function handleUnsupportedUserProvidedTargetsErrors(
  userProvidedTargetName: string,
  validFoundTargetName: string,
  target: Target,
  executor: 'rspack' | 'dev-server'
) {
  logger.warn(
    `The custom ${target} target you provided (${userProvidedTargetName}) cannot be converted to use the @nx/rspack:${executor} executor.
     However, we found the following ${target} target in your project that can be converted: ${validFoundTargetName}

     Please note that converting a potentially non-compatible project to use Vite.js may result in unexpected behavior. Always commit
     your changes before converting a project to use Vite.js, and test the converted project thoroughly before deploying it.
    `
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should we convert the ${validFoundTargetName} target to use the @nx/rspack:${executor} executor?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(
      `The ${target} target ${userProvidedTargetName} cannot be converted to use the @nx/rspack:${executor} executor.
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
      can be converted to the @nx/rspack executors.

      This either means that your project may not have a target
      for building, serving, or testing at all, or that your targets are
      using executors that are not known to Nx.

      If you still want to convert your project to use the @nx/rspack executors,
      please make sure to commit your changes before running this generator.
      `
  );

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Confirm } = require('enquirer');
  const prompt = new Confirm({
    name: 'question',
    message: `Should Nx convert your project to use the @nx/rspack executors?`,
    initial: true,
  });
  const shouldConvert = await prompt.run();
  if (!shouldConvert) {
    throw new Error(`
      Nx could not verify that the executors you are using can be converted to the @nx/rspack executors.
      Please try again with a different project.
    `);
  }
}

export function determineFrameworkAndTarget(
  tree: Tree,
  options: ConfigurationSchema,
  projectRoot: string,
  targets: {
    [targetName: string]: TargetConfiguration<any>;
  }
): { target: 'node' | 'web'; framework?: Framework } {
  ensureTypescript();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { tsquery } = require('@phenomnomnominal/tsquery');

  // First try to infer if the target is node
  if (options.target !== 'node') {
    // Try to infer from jest config if the env is node
    let jestConfigPath: string;
    if (
      targets?.test?.executor !== '@nx/jest:jest' &&
      targets?.test?.options?.jestConfig
    ) {
      jestConfigPath = targets?.test?.options?.jestConfig;
    } else {
      jestConfigPath = joinPathFragments(projectRoot, 'jest.config.ts');
    }

    if (!tree.exists(jestConfigPath)) {
      return { target: options.target, framework: options.framework };
    }
    const appFileContent = tree.read(jestConfigPath, 'utf-8');
    const file = tsquery.ast(appFileContent);
    // find testEnvironment: 'node' in jest config
    const testEnvironment = tsquery(
      file,
      `PropertyAssignment:has(Identifier[name="testEnvironment"]) > StringLiteral[value="node"]`
    );
    if (testEnvironment.length > 0) {
      return { target: 'node', framework: options.framework };
    }

    if (tree.exists(joinPathFragments(projectRoot, 'src/main.ts'))) {
      const appFileContent = tree.read(
        joinPathFragments(projectRoot, 'src/main.ts'),
        'utf-8'
      );
      const file = tsquery.ast(appFileContent);
      const hasNestJsDependency = tsquery(
        file,
        `ImportDeclaration:has(StringLiteral[value="@nestjs/common"])`
      );
      if (hasNestJsDependency?.length > 0) {
        return { target: 'node', framework: 'nest' };
      }
    }
  }

  if (options.framework === 'nest') {
    return { target: 'node', framework: 'nest' };
  }

  if (options.framework !== 'react' && options.target === 'web') {
    // Look if React is used in the project
    let tsConfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
    if (!tree.exists(tsConfigPath)) {
      tsConfigPath = determineTsConfig(tree, options);
    }
    const tsConfig = JSON.parse(tree.read(tsConfigPath).toString());
    if (tsConfig?.compilerOptions?.jsx?.includes('react')) {
      return { target: 'web', framework: 'react' };
    } else {
      return { target: options.target, framework: options.framework };
    }
  }

  return { target: options.target, framework: options.framework };
}

export function determineMain(tree: Tree, options: ConfigurationSchema) {
  if (options.main) return options.main;

  const project = readProjectConfiguration(tree, options.project);

  const mainTsx = joinPathFragments(project.root, 'src/main.tsx');
  if (tree.exists(mainTsx)) return mainTsx;

  return joinPathFragments(project.root, 'src/main.ts');
}

export function determineTsConfig(tree: Tree, options: ConfigurationSchema) {
  if (options.tsConfig) return options.tsConfig;

  const project = readProjectConfiguration(tree, options.project);

  const appJson = joinPathFragments(project.root, 'tsconfig.app.json');
  if (tree.exists(appJson)) return appJson;

  const libJson = joinPathFragments(project.root, 'tsconfig.lib.json');
  if (tree.exists(libJson)) return libJson;

  return joinPathFragments(project.root, 'tsconfig.json');
}
