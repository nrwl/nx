import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  TargetConfiguration,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateTsConfigsToJs,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { configurationGenerator } from '@nx/jest';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
  tsConfigBaseOptions,
} from '@nx/js';
import { esbuildVersion } from '@nx/js/src/utils/versions';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { join } from 'path';
import {
  expressTypingsVersion,
  expressVersion,
  fastifyAutoloadVersion,
  fastifyPluginVersion,
  fastifySensibleVersion,
  fastifyVersion,
  koaTypingsVersion,
  koaVersion,
  nxVersion,
  tslibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { e2eProjectGenerator } from '../e2e-project/e2e-project';
import { initGenerator } from '../init/init';
import { setupDockerGenerator } from '../setup-docker/setup-docker';
import { Schema } from './schema';
import { hasWebpackPlugin } from '../../utils/has-webpack-plugin';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
  importPath: string;
  isUsingTsSolutionConfig: boolean;
}

function getWebpackBuildConfig(
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: `@nx/webpack:webpack`,
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      target: 'node',
      compiler: 'tsc',
      outputPath: options.outputPath,
      main: joinPathFragments(
        project.sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
      generatePackageJson: options.isUsingTsSolutionConfig ? undefined : true,
    },
    configurations: {
      development: {},
      production: {
        ...(options.docker && { generateLockfile: true }),
      },
    },
  };
}

function getEsBuildConfig(
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/esbuild:esbuild',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      platform: 'node',
      outputPath: options.outputPath,
      // Use CJS for Node apps for widest compatibility.
      format: ['cjs'],
      bundle: false,
      main: joinPathFragments(
        project.sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
      generatePackageJson: options.isUsingTsSolutionConfig ? undefined : true,
      esbuildOptions: {
        sourcemap: true,
        // Generate CJS files as .js so imports can be './foo' rather than './foo.cjs'.
        outExtension: { '.js': '.js' },
      },
    },
    configurations: {
      development: {},
      production: {
        ...(options.docker && { generateLockfile: true }),
        esbuildOptions: {
          sourcemap: false,
          // Generate CJS files as .js so imports can be './foo' rather than './foo.cjs'.
          outExtension: { '.js': '.js' },
        },
      },
    },
  };
}

function getServeConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nx/js:node',
    defaultConfiguration: 'development',
    // Run build, which includes dependency on "^build" by default, so the first run
    // won't error out due to missing build artifacts.
    dependsOn: ['build'],
    options: {
      buildTarget: `${options.name}:build`,
      // Even though `false` is the default, set this option so users know it
      // exists if they want to always run dependencies during each rebuild.
      runBuildTargetDependencies: false,
    },
    configurations: {
      development: {
        buildTarget: `${options.name}:build:development`,
      },
      production: {
        buildTarget: `${options.name}:build:production`,
      },
    },
  };
}

function getNestWebpackBuildConfig(): TargetConfiguration {
  return {
    executor: 'nx:run-commands',
    options: {
      command: 'webpack-cli build',
      args: ['node-env=production'],
    },
    configurations: {
      development: {
        args: ['node-env=development'],
      },
    },
  };
}

function addProject(tree: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  if (options.bundler === 'esbuild') {
    addBuildTargetDefaults(tree, '@nx/esbuild:esbuild');
    project.targets.build = getEsBuildConfig(project, options);
  } else if (options.bundler === 'webpack') {
    if (!hasWebpackPlugin(tree)) {
      addBuildTargetDefaults(tree, `@nx/webpack:webpack`);
      project.targets.build = getWebpackBuildConfig(project, options);
    } else if (options.isNest) {
      // If we are using Nest that has the webpack plugin we need to override the
      // build target so that node-env can be set to production or development so the serve target can be run in development mode
      project.targets.build = getNestWebpackBuildConfig();
    }
  }
  project.targets.serve = getServeConfig(options);

  if (options.isUsingTsSolutionConfig) {
    writeJson(tree, joinPathFragments(options.appProjectRoot, 'package.json'), {
      name: options.importPath,
      version: '0.0.1',
      private: true,
      nx: {
        name: options.name,
        projectType: 'application',
        sourceRoot: project.sourceRoot,
        targets: project.targets,
        tags: project.tags?.length ? project.tags : undefined,
      },
    });
  } else {
    addProjectConfiguration(
      tree,
      options.name,
      project,
      options.standaloneConfig
    );
  }
}

function addAppFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(
    tree,
    join(__dirname, './files/common'),
    options.appProjectRoot,
    {
      ...options,
      tmpl: '',
      name: options.name,
      root: options.appProjectRoot,
      offset: offsetFromRoot(options.appProjectRoot),
      rootTsConfigPath: getRelativePathToRootTsConfig(
        tree,
        options.appProjectRoot
      ),
      webpackPluginOptions: hasWebpackPlugin(tree)
        ? {
            outputPath: options.isUsingTsSolutionConfig
              ? 'dist'
              : joinPathFragments(
                  offsetFromRoot(options.appProjectRoot),
                  'dist',
                  options.rootProject ? options.name : options.appProjectRoot
                ),
            main: './src/main' + (options.js ? '.js' : '.ts'),
            tsConfig: './tsconfig.app.json',
            assets: ['./src/assets'],
          }
        : null,
    }
  );

  if (options.bundler !== 'webpack') {
    tree.delete(joinPathFragments(options.appProjectRoot, 'webpack.config.js'));
  }

  if (options.framework && options.framework !== 'none') {
    generateFiles(
      tree,
      join(__dirname, `./files/${options.framework}`),
      options.appProjectRoot,
      {
        ...options,
        tmpl: '',
        name: options.name,
        root: options.appProjectRoot,
        offset: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
      }
    );
  }
  if (options.js) {
    toJS(tree);
  }
}

function addProxy(tree: Tree, options: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(tree, options.frontendProject);
  if (projectConfig.targets && projectConfig.targets.serve) {
    const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
    projectConfig.targets.serve.options = {
      ...projectConfig.targets.serve.options,
      proxyConfig: pathToProxyFile,
    };

    if (!tree.exists(pathToProxyFile)) {
      tree.write(
        pathToProxyFile,
        JSON.stringify(
          {
            '/api': {
              target: `http://localhost:${options.port}`,
              secure: false,
            },
          },
          null,
          2
        )
      );
    } else {
      //add new entry to existing config
      const proxyFileContent = tree.read(pathToProxyFile).toString();

      const proxyModified = {
        ...JSON.parse(proxyFileContent),
        [`/${options.name}-api`]: {
          target: `http://localhost:${options.port}`,
          secure: false,
        },
      };

      tree.write(pathToProxyFile, JSON.stringify(proxyModified, null, 2));
    }

    updateProjectConfiguration(tree, options.frontendProject, projectConfig);
  } else {
    logger.warn(
      `Skip updating proxy for frontend project "${options.frontendProject}" since "serve" target is not found in project.json. For more information, see: https://nx.dev/recipes/node/application-proxies.`
    );
  }
}

export async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    skipFormat: true,
    setParserOptionsProject: options.setParserOptionsProject,
    rootProject: options.rootProject,
    addPlugin: options.addPlugin,
  });

  return lintTask;
}

function addProjectDependencies(
  tree: Tree,
  options: NormalizedSchema
): GeneratorCallback {
  const bundlers = {
    webpack: {
      '@nx/webpack': nxVersion,
    },
    esbuild: {
      '@nx/esbuild': nxVersion,
      esbuild: esbuildVersion,
    },
  };

  const frameworkDependencies = {
    express: {
      express: expressVersion,
    },
    koa: {
      koa: koaVersion,
    },
    fastify: {
      fastify: fastifyVersion,
      'fastify-plugin': fastifyPluginVersion,
      '@fastify/autoload': fastifyAutoloadVersion,
      '@fastify/sensible': fastifySensibleVersion,
    },
  };
  const frameworkDevDependencies = {
    express: {
      '@types/express': expressTypingsVersion,
    },
    koa: {
      '@types/koa': koaTypingsVersion,
    },
    fastify: {},
  };
  return addDependenciesToPackageJson(
    tree,
    {
      ...frameworkDependencies[options.framework],
      tslib: tslibVersion,
    },
    {
      ...frameworkDevDependencies[options.framework],
      ...bundlers[options.bundler],
      '@types/node': typesNodeVersion,
    }
  );
}

function updateTsConfigOptions(tree: Tree, options: NormalizedSchema) {
  if (options.isUsingTsSolutionConfig) {
    return;
  }

  updateJson(tree, `${options.appProjectRoot}/tsconfig.json`, (json) => {
    if (options.rootProject) {
      return {
        compilerOptions: {
          ...tsConfigBaseOptions,
          ...json.compilerOptions,
          esModuleInterop: true,
        },
        ...json,
        extends: undefined,
        exclude: ['node_modules', 'tmp'],
      };
    } else {
      return {
        ...json,
        compilerOptions: {
          ...json.compilerOptions,
          esModuleInterop: true,
        },
      };
    }
  });
}

export async function applicationGenerator(tree: Tree, schema: Schema) {
  return await applicationGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export async function applicationGeneratorInternal(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
    addTsPlugin: schema.useTsSolution,
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(tree, schema);

  if (options.framework === 'nest') {
    // nx-ignore-next-line
    const { applicationGenerator } = ensurePackage('@nx/nest', nxVersion);
    const nestTasks = await applicationGenerator(tree, {
      ...options,
      skipFormat: true,
    });
    tasks.push(nestTasks);

    if (options.docker) {
      const dockerTask = await setupDockerGenerator(tree, {
        ...options,
        project: options.name,
        skipFormat: true,
      });
      tasks.push(dockerTask);
    }
    return runTasksInSerial(
      ...[
        ...tasks,
        () => {
          logShowProjectCommand(options.name);
        },
      ]
    );
  }

  const initTask = await initGenerator(tree, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(initTask);

  const installTask = addProjectDependencies(tree, options);
  tasks.push(installTask);

  if (options.bundler === 'webpack') {
    const { webpackInitGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    const webpackInitTask = await webpackInitGenerator(tree, {
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    tasks.push(webpackInitTask);
    if (!options.skipPackageJson) {
      const { ensureDependencies } = await import(
        '@nx/webpack/src/utils/ensure-dependencies'
      );
      tasks.push(
        ensureDependencies(tree, {
          uiFramework: options.isNest ? 'none' : 'react',
        })
      );
    }
  }

  addAppFiles(tree, options);
  addProject(tree, options);

  updateTsConfigOptions(tree, options);

  if (options.linter === Linter.EsLint) {
    const lintTask = await addLintingToApplication(tree, options);
    tasks.push(lintTask);
  }

  if (options.unitTestRunner === 'jest') {
    const jestTask = await configurationGenerator(tree, {
      ...options,
      project: options.name,
      setupFile: 'none',
      skipSerializers: true,
      supportTsx: options.js,
      testEnvironment: 'node',
      compiler: options.swcJest ? 'swc' : 'tsc',
      skipFormat: true,
    });
    tasks.push(jestTask);
    // There are no tests by default, so set `--passWithNoTests` to avoid test failure on new project.
    const projectConfig = readProjectConfiguration(tree, options.name);
    projectConfig.targets ??= {};
    projectConfig.targets.test = {
      options: { passWithNoTests: true },
    };
    updateProjectConfiguration(tree, options.name, projectConfig);
  } else {
    // No need for default spec file if unit testing is not setup.
    tree.delete(
      joinPathFragments(options.appProjectRoot, 'src/app/app.spec.ts')
    );
  }

  if (options.e2eTestRunner === 'jest') {
    const e2eTask = await e2eProjectGenerator(tree, {
      ...options,
      projectType: options.framework === 'none' ? 'cli' : 'server',
      name: options.rootProject ? 'e2e' : `${options.name}-e2e`,
      directory: options.rootProject ? 'e2e' : `${options.appProjectRoot}-e2e`,
      project: options.name,
      port: options.port,
      isNest: options.isNest,
      skipFormat: true,
    });
    tasks.push(e2eTask);
  }

  if (options.js) {
    updateTsConfigsToJs(tree, { projectRoot: options.appProjectRoot });
  }

  if (options.frontendProject) {
    addProxy(tree, options);
  }

  if (options.docker) {
    const dockerTask = await setupDockerGenerator(tree, {
      ...options,
      project: options.name,
      skipFormat: true,
    });

    tasks.push(dockerTask);
  }

  if (options.isUsingTsSolutionConfig) {
    updateTsconfigFiles(
      tree,
      options.appProjectRoot,
      'tsconfig.app.json',
      {
        module: 'nodenext',
        moduleResolution: 'nodenext',
      },
      options.linter === 'eslint'
        ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
        : undefined
    );
  }

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(tree, options.appProjectRoot);
  }

  sortPackageJsonFields(tree, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    rootProject: options.rootProject,
  });
  options.rootProject = appProjectRoot === '.';

  options.bundler = options.bundler ?? 'esbuild';
  options.e2eTestRunner = options.e2eTestRunner ?? 'jest';

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const swcJest = options.swcJest ?? isUsingTsSolutionConfig;

  return {
    addPlugin,
    ...options,
    name: appProjectName,
    frontendProject: options.frontendProject
      ? names(options.frontendProject).fileName
      : undefined,
    appProjectRoot,
    importPath,
    parsedTags,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? 'jest',
    rootProject: options.rootProject ?? false,
    port: options.port ?? 3000,
    outputPath: isUsingTsSolutionConfig
      ? joinPathFragments(appProjectRoot, 'dist')
      : joinPathFragments(
          'dist',
          options.rootProject ? options.name : appProjectRoot
        ),
    isUsingTsSolutionConfig,
    swcJest,
  };
}

export default applicationGenerator;
