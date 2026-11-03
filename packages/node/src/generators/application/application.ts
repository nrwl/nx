import {
  findMatchingConfigFiles,
  logShowProjectCommand,
} from '@nx/devkit/internal';
import {
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  updateTsConfigsToJs,
} from '@nx/devkit';
import { configurationGenerator } from '@nx/jest';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  addProjectToTsSolutionWorkspace,
  getTsConfigBaseOptions,
  shouldConfigureTsSolutionSetup,
  updateTsconfigFiles,
  sortPackageJsonFields,
} from '@nx/js/internal';
import { assertSupportedFrameworkVersion } from '../../utils/assert-supported-framework-version';
import { nxVersion } from '../../utils/versions';
import { e2eProjectGenerator } from '../e2e-project/e2e-project';
import { initGenerator } from '../init/init';
import { setupDockerGenerator } from '../setup-docker/setup-docker';
import { Schema } from './schema';
import {
  addAppFiles,
  addScriptServe,
  addLintingToApplication,
  addProject,
  addProjectDependencies,
  addProxy,
  normalizeOptions,
  NormalizedSchema,
} from './lib';

/**
 * Returns the build target name of the rolldown registration that covers the
 * app. init skips registering when one exists, even if its `exclude` covers the
 * app, so a scoped registration is added then.
 */
function ensureRolldownBuildTarget(tree: Tree, projectRoot: string): string {
  const configFile = joinPathFragments(projectRoot, 'rolldown.config.ts');
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];
  const registration = nxJson.plugins.find((p) =>
    typeof p === 'string'
      ? p === '@nx/rolldown/plugin'
      : p.plugin === '@nx/rolldown/plugin' &&
        findMatchingConfigFiles([configFile], p.include, p.exclude).length > 0
  );
  if (!registration) {
    nxJson.plugins.push({
      plugin: '@nx/rolldown/plugin',
      include: [configFile],
      options: { buildTargetName: 'build' },
    });
    updateNxJson(tree, nxJson);
    return 'build';
  }
  return (
    (typeof registration === 'object' &&
      (registration.options as { buildTargetName?: string })
        ?.buildTargetName) ||
    'build'
  );
}

// fastify.inject requires ESM-only `cookie` 2, which Jest cannot load untransformed.
function allowJestToTransformCookie(tree: Tree, projectRoot: string) {
  const configFile = ['jest.config.cts', 'jest.config.ts', 'jest.config.js']
    .map((f) => joinPathFragments(projectRoot, f))
    .find((f) => tree.exists(f));
  if (!configFile) {
    return;
  }
  const config = tree.read(configFile, 'utf-8');
  tree.write(
    configFile,
    config.replace(
      /^(\s*)moduleFileExtensions:/m,
      `$1transformIgnorePatterns: ['/node_modules/(?!(\\\\.pnpm/[^/]+/node_modules/)?cookie/)'],\n$1moduleFileExtensions:`
    )
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
          ...getTsConfigBaseOptions(tree),
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
    useProjectJson: true,
    ...schema,
  });
}

export async function applicationGeneratorInternal(tree: Tree, schema: Schema) {
  assertSupportedFrameworkVersion(tree, schema.framework);

  const tasks: GeneratorCallback[] = [];

  const addTsPlugin = shouldConfigureTsSolutionSetup(
    tree,
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

  const { installTask, frameworkDependencies } = addProjectDependencies(
    tree,
    options
  );
  tasks.push(installTask);

  if (options.bundler === 'webpack') {
    const { webpackInitGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    const webpackInitTask = await webpackInitGenerator(tree, {
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
    tasks.push(webpackInitTask);
    if (!options.skipPackageJson) {
      // Use CommonJS `require` rather than a dynamic ESM `import`:
      // `ensurePackage` makes the on-demand-installed package available via
      // `Module._initPaths`, which `require()` honors but ESM resolution does
      // not. Under nodenext, a dynamic `import()` is preserved as a true ESM
      // dynamic import, so it can't see the temp install.
      const {
        ensureDependencies,
      }: typeof import('@nx/webpack/internal') = require('@nx/webpack/internal');
      tasks.push(
        ensureDependencies(tree, {
          uiFramework: options.isNest ? 'none' : 'react',
        })
      );
    }
  }

  if (options.bundler === 'rolldown') {
    ensurePackage('@nx/rolldown', nxVersion);
    // CommonJS `require` instead of dynamic ESM `import`: `ensurePackage`
    // exposes the temp install via `Module._initPaths`, which ESM ignores.
    const {
      rolldownInitGenerator,
    }: typeof import('@nx/rolldown') = require('@nx/rolldown');
    tasks.push(
      await rolldownInitGenerator(tree, {
        skipPackageJson: options.skipPackageJson,
        skipFormat: true,
      })
    );
    // The registration may infer `bundle`/`rolldown:build` instead of `build`.
    options.buildTargetName = ensureRolldownBuildTarget(
      tree,
      options.appProjectRoot
    );
  }

  addAppFiles(tree, options);
  if (options.serveRuntime) {
    addScriptServe(tree, options);
  }
  addProject(tree, options, frameworkDependencies);

  if (options.bundler === 'rolldown') {
    const {
      configurationGenerator: rolldownConfigurationGenerator,
    }: typeof import('@nx/rolldown') = require('@nx/rolldown');
    await rolldownConfigurationGenerator(tree, {
      project: options.name,
      main: joinPathFragments(
        options.appProjectRoot,
        'src',
        options.js ? 'main.js' : 'main.ts'
      ),
      outputPath: options.outputPath,
      // Matches the app's module type (see create-project).
      format: options.serveRuntime === 'node' ? 'esm' : 'cjs',
      platform: 'node',
      skipPackageJson: true,
      skipFormat: true,
    });
  }

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(tree, options.appProjectRoot);
  }

  updateTsConfigOptions(tree, options);

  if (options.linter !== 'none') {
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
    if (options.framework === 'fastify') {
      allowJestToTransformCookie(tree, options.appProjectRoot);
    }
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
  } else if (options.unitTestRunner === 'vitest') {
    ensurePackage('@nx/vitest', nxVersion);
    // CommonJS `require` instead of dynamic ESM `import`: `ensurePackage`
    // exposes the temp install via `Module._initPaths`, which ESM ignores.
    const {
      configurationGenerator,
    }: typeof import('@nx/vitest/generators') = require('@nx/vitest/generators');
    const vitestTask = await configurationGenerator(tree, {
      project: options.name,
      uiFramework: 'none',
      coverageProvider: 'v8',
      testEnvironment: 'node',
      runtimeTsconfigFileName: 'tsconfig.app.json',
      // Only the fastify template ships a spec, so the other frameworks would
      // otherwise fail `nx test` on a freshly generated app.
      passWithNoTests: true,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
    tasks.push(vitestTask);
  } else {
    // No need for default spec file if unit testing is not setup.
    tree.delete(
      joinPathFragments(options.appProjectRoot, 'src/app/app.spec.ts')
    );
  }

  if (options.e2eTestRunner === 'jest' || options.e2eTestRunner === 'vitest') {
    const e2eTask = await e2eProjectGenerator(tree, {
      ...options,
      projectType: options.framework === 'none' ? 'cli' : 'server',
      name: options.rootProject ? 'e2e' : `${options.name}-e2e`,
      directory: options.rootProject ? 'e2e' : `${options.appProjectRoot}-e2e`,
      project: options.name,
      buildTarget: options.buildTargetName,
      testRunner: options.e2eTestRunner,
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
      buildTarget: options.buildTargetName,
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
        // The TS solution base only emits declarations; the tsc build runs the app.
        ...(options.bundler === 'tsc' && { emitDeclarationOnly: false }),
        // tsconfig.app.json extends the base, not the tsconfig.json that has it.
        ...(options.js && { allowJs: true }),
        // Node runs the sources, so relative imports name `.ts` files.
        ...(options.serveRuntime === 'node' && {
          rewriteRelativeImportExtensions: true,
        }),
      },
      options.linter === 'eslint'
        ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
        : undefined
    );

    const specTsConfig = joinPathFragments(
      options.appProjectRoot,
      'tsconfig.spec.json'
    );
    if (options.serveRuntime === 'node' && tree.exists(specTsConfig)) {
      // Specs import `./x.ts` too, but rewriting them is unsafe (TS2878) since
      // the app is a referenced project with its own outDir.
      updateJson(tree, specTsConfig, (json) => {
        delete json.compilerOptions.rewriteRelativeImportExtensions;
        delete json.compilerOptions.emitDeclarationOnly;
        json.compilerOptions.allowImportingTsExtensions = true;
        return json;
      });
    }
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
