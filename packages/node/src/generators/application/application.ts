import {
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateTsConfigsToJs,
} from '@nx/devkit';
import { configurationGenerator } from '@nx/jest';
import { initGenerator as jsInitGenerator, tsConfigBaseOptions } from '@nx/js';
import {
  addProjectToTsSolutionWorkspace,
  shouldConfigureTsSolutionSetup,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { nxVersion } from '../../utils/versions';
import { e2eProjectGenerator } from '../e2e-project/e2e-project';
import { initGenerator } from '../init/init';
import { setupDockerGenerator } from '../setup-docker/setup-docker';
import { Schema } from './schema';
import {
  addAppFiles,
  addLintingToApplication,
  addProject,
  addProjectDependencies,
  addProxy,
  normalizeOptions,
  NormalizedSchema,
} from './lib';

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
    useProjectJson: true,
    ...schema,
  });
}

export async function applicationGeneratorInternal(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const addTsPlugin = shouldConfigureTsSolutionSetup(
    tree,
    schema.addPlugin,
    schema.useTsSolution
  );
  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
    addTsPlugin,
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

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(tree, options.appProjectRoot);
  }

  updateTsConfigOptions(tree, options);

  if (options.linter === 'eslint') {
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
      ...projectConfig.targets.test,
      options: {
        ...projectConfig.targets.test?.options,
        passWithNoTests: true,
      },
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
      skipDockerPlugin: options.skipDockerPlugin ?? false,
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

  sortPackageJsonFields(tree, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
