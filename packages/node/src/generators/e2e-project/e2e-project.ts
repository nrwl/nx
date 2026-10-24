import {
  determineProjectNameAndRootOptions,
  logShowProjectCommand,
  type PackageJson,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  names,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { lintProjectGenerator } from '@nx/eslint';
import {
  addLintingToProject,
  normalizeLinterOption,
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
  addSwcTestConfig,
} from '@nx/js/internal';
import {
  javaScriptOverride,
  typeScriptOverride,
  addPluginsToLintConfig,
  isEslintConfigSupported,
  replaceOverridesInLintConfig,
} from '@nx/eslint/internal';
import { existsSync } from 'node:fs';
import * as path from 'path';
import { axiosVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import {
  ensureRootJest,
  findRootJestPreset,
  getInstalledJestMajorVersion,
} from '@nx/jest/internal';
import { relative } from 'node:path/posix';

export async function e2eProjectGenerator(host: Tree, options: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    useProjectJson: true,
    ...options,
  });
}

export async function e2eProjectGeneratorInternal(
  host: Tree,
  _options: Schema
) {
  const tasks: GeneratorCallback[] = [];
  const options = await normalizeOptions(host, _options);
  const appProject = readProjectConfiguration(host, options.project);

  // Detect Jest 30+ to use .cts config files (CommonJS TypeScript)
  const jestMajorVersion = getInstalledJestMajorVersion(host);
  const useCommonJsConfig = jestMajorVersion === null || jestMajorVersion >= 30;

  const dependsOn = [
    `${options.project}:${options.buildTarget ?? 'build'}`,
    `${options.project}:serve`,
  ];

  // TODO(@ndcunningham): This is broken.. the outputs are wrong.. and this isn't using the jest generator
  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    packageJson.nx = {
      name:
        options.e2eProjectName !== options.importPath
          ? options.e2eProjectName
          : undefined,
      implicitDependencies: [options.project],
      targets: {
        // @nx/vitest infers the rest of the vitest e2e target.
        e2e:
          options.testRunner === 'vitest'
            ? { dependsOn }
            : {
                command: 'jest --passWithNoTests',
                options: { cwd: options.e2eProjectRoot },
                outputs: ['{projectRoot}/test-output/jest/coverage'],
                dependsOn,
              },
      },
    };
  } else {
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      implicitDependencies: [options.project],
      projectType: 'application',
      targets: {
        e2e:
          options.testRunner === 'vitest'
            ? { dependsOn }
            : {
                command: 'jest --passWithNoTests',
                options: { cwd: options.e2eProjectRoot },
                outputs: ['{workspaceRoot}/coverage/{e2eProjectRoot}'],
                dependsOn,
              },
      },
    });
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      host,
      joinPathFragments(options.e2eProjectRoot, 'package.json'),
      packageJson
    );
  }

  // TODO(@nicholas): Find a better way to get build target

  // We remove the 'test' target from the e2e project because it is not needed
  // The 'e2e' target is the one that should run the tests for the e2e project
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) => {
    if (typeof p !== 'string' && p.plugin === '@nx/jest/plugin') {
      return true;
    }
  });

  if (hasPlugin) {
    updateJson(host, 'nx.json', (json) => {
      return {
        ...json,
        plugins: json.plugins?.map((p) => {
          if (typeof p !== 'string' && p.plugin === '@nx/jest/plugin') {
            return {
              ...p,
              exclude: [...(p.exclude || []), `${options.e2eProjectRoot}/**/*`],
            };
          }
          return p;
        }),
      };
    });
  }

  // The app may use another unit test runner, leaving no Jest setup to share.
  if (options.testRunner !== 'vitest' && !findRootJestPreset(host)) {
    tasks.push(await ensureRootJest(host));
  }

  const jestPreset = findRootJestPreset(host) ?? 'jest.preset.js';
  const tsConfigFile = options.isUsingTsSolutionConfig
    ? 'tsconfig.json'
    : 'tsconfig.spec.json';
  const rootOffset = offsetFromRoot(options.e2eProjectRoot);
  const coverageDirectory = options.isUsingTsSolutionConfig
    ? 'test-output/jest/coverage'
    : joinPathFragments(rootOffset, 'coverage', options.e2eProjectName);
  const projectSimpleName = options.project.split('/').pop();
  if (options.projectType === 'server') {
    generateFiles(
      host,
      path.join(__dirname, 'files/server/common'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : projectSimpleName),
        tsConfigFile,
        offsetFromRoot: rootOffset,
        jestPreset,
        coverageDirectory,
        js: useCommonJsConfig,
        tmpl: '',
      }
    );

    if (options.isNest) {
      generateFiles(
        host,
        path.join(__dirname, 'files/server/nest'),
        options.e2eProjectRoot,
        {
          ...options,
          ...names(options.rootProject ? 'server' : projectSimpleName),
          tsConfigFile,
          offsetFromRoot: rootOffset,
          tmpl: '',
        }
      );
    }
  } else if (options.projectType === 'cli') {
    // Inferred builds (tsc, rolldown) have no outputPath option; use the
    // output dir the app generator configures.
    const mainFile =
      appProject.targets.build?.options?.outputPath ??
      joinPathFragments(
        options.isUsingTsSolutionConfig
          ? joinPathFragments(appProject.root, 'dist')
          : joinPathFragments(
              'dist',
              appProject.root === '.' ? options.project : appProject.root
            ),
        'main.js'
      );
    generateFiles(
      host,
      path.join(__dirname, 'files/cli'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'cli' : projectSimpleName),
        mainFile,
        tsConfigFile,
        offsetFromRoot: rootOffset,
        jestPreset,
        coverageDirectory,
        js: useCommonJsConfig,
        tmpl: '',
      }
    );
  }

  if (options.testRunner === 'vitest') {
    tasks.push(
      await addVitest(
        host,
        options.e2eProjectRoot,
        options.e2eProjectName,
        dependsOn
      )
    );
    host.delete(joinPathFragments(options.e2eProjectRoot, 'jest.config.ts'));
    for (const file of [
      'src/test-setup.ts',
      'src/support/global-teardown.ts',
    ]) {
      const filePath = joinPathFragments(options.e2eProjectRoot, file);
      if (host.exists(filePath)) host.delete(filePath);
    }
    for (const dir of ['common', options.projectType]) {
      const templates = path.join(__dirname, 'files/vitest', dir);
      if (existsSync(templates)) {
        generateFiles(host, templates, options.e2eProjectRoot, {
          ...options,
          tmpl: '',
        });
      }
    }
  }

  // Rename jest.config.ts to jest.config.cts for Jest 30+
  const jestConfigPath = joinPathFragments(
    options.e2eProjectRoot,
    'jest.config.ts'
  );
  if (host.exists(jestConfigPath) && useCommonJsConfig) {
    host.rename(
      jestConfigPath,
      joinPathFragments(options.e2eProjectRoot, 'jest.config.cts')
    );
  }

  if (options.isUsingTsSolutionConfig) {
    if (options.testRunner !== 'vitest') {
      addSwcTestConfig(host, options.e2eProjectRoot, 'es6');
    }
    generateFiles(
      host,
      path.join(__dirname, 'files/ts-solution'),
      options.e2eProjectRoot,
      {
        ...options,
        relativeProjectReferencePath: relative(
          options.e2eProjectRoot,
          appProject.root
        ),
        offsetFromRoot: rootOffset,
        tmpl: '',
      }
    );
  } else {
    generateFiles(
      host,
      path.join(__dirname, 'files/non-ts-solution'),
      options.e2eProjectRoot,
      {
        ...options,
        offsetFromRoot: rootOffset,
        tmpl: '',
      }
    );
  }

  // axios is more than likely used in the application code, so install it as a regular dependency.
  const installTask = addDependenciesToPackageJson(
    host,
    { axios: axiosVersion },
    {}
  );
  tasks.push(installTask);

  if (
    options.linter &&
    options.linter !== 'eslint' &&
    options.linter !== 'none'
  ) {
    tasks.push(
      await addLintingToProject(host, {
        linter: options.linter,
        project: options.e2eProjectName,
        rootProject: options.rootProject,
        // The generated e2e specs are Jest; this is what enables the linter's
        // Jest rules.
        unitTestRunner: options.testRunner,
      })
    );
  }

  if (options.linter === 'eslint') {
    const linterTask = await lintProjectGenerator(host, {
      project: options.e2eProjectName,
      linter: 'eslint',
      skipFormat: true,
      tsConfigPaths: [
        joinPathFragments(options.e2eProjectRoot, 'tsconfig.json'),
      ],
      enableTypedLinting: false,
      skipPackageJson: false,
      rootProject: options.rootProject,
    });
    tasks.push(linterTask);

    if (options.rootProject && isEslintConfigSupported(host)) {
      addPluginsToLintConfig(host, options.e2eProjectRoot, '@nx');
      replaceOverridesInLintConfig(host, options.e2eProjectRoot, [
        typeScriptOverride,
        javaScriptOverride,
      ]);
    }
  }

  if (options.isUsingTsSolutionConfig) {
    updateJson(host, 'tsconfig.json', (json) => {
      json.references ??= [];
      const e2eRef = `./${options.e2eProjectRoot}`;
      if (!json.references.find((ref) => ref.path === e2eRef)) {
        json.references.push({ path: e2eRef });
      }
      return json;
    });
  }

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(host, options.e2eProjectRoot);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.e2eProjectName);
  });

  return runTasksInSerial(...tasks);
}

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<
  Omit<Schema, 'name'> & {
    e2eProjectRoot: string;
    e2eProjectName: string;
    importPath: string;
    isUsingTsSolutionConfig: boolean;
  }
> {
  let directory = options.rootProject ? 'e2e' : options.directory;
  if (!directory) {
    const projectConfig = readProjectConfiguration(tree, options.project);
    directory = `${projectConfig.root}-e2e`;
  }
  const {
    projectName: e2eProjectName,
    projectRoot: e2eProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'application',
    directory,
  });

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(tree);

  return {
    ...options,
    // Both arms below test for a concrete linter, so an unresolved `undefined`
    // would fall through them and leave the e2e project with no linter at all.
    linter: await normalizeLinterOption(tree, options.linter),
    e2eProjectRoot,
    e2eProjectName,
    importPath,
    port: options.port ?? 3000,
    testRunner: options.testRunner ?? 'jest',
    rootProject: !!options.rootProject,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
  };
}

async function addVitest(
  tree: Tree,
  e2eProjectRoot: string,
  e2eProjectName: string,
  dependsOn: string[]
) {
  ensurePackage('@nx/vitest', nxVersion);
  // CommonJS `require` instead of dynamic ESM `import`: `ensurePackage`
  // exposes the temp install via `Module._initPaths`, which ESM ignores.
  const {
    initGenerator,
  }: typeof import('@nx/vitest/generators') = require('@nx/vitest/generators');
  const task = await initGenerator(tree, {
    skipFormat: true,
  });

  // A scoped registration infers `e2e`; the others would add a `test` target.
  const include = `${e2eProjectRoot}/**/*`;
  const nxJson = readNxJson(tree);
  // Split tasks get no `dependsOn` from `e2e`, so give them the app's serve here.
  const ciTargetDefaults = nxJson.targetDefaults?.['e2e-ci--**/**'];
  updateNxJson(tree, {
    ...nxJson,
    targetDefaults: {
      ...nxJson.targetDefaults,
      'e2e-ci--**/**': [
        ...(Array.isArray(ciTargetDefaults)
          ? ciTargetDefaults
          : ciTargetDefaults
            ? [ciTargetDefaults]
            : []),
        { filter: { projects: [e2eProjectName] }, dependsOn },
      ],
    },
    plugins: [
      ...(nxJson.plugins ?? []).map((p) => {
        const registration = typeof p === 'string' ? { plugin: p } : p;
        return registration.plugin === '@nx/vitest'
          ? {
              ...registration,
              exclude: [...(registration.exclude ?? []), include],
            }
          : p;
      }),
      {
        plugin: '@nx/vitest',
        include: [include],
        options: {
          testTargetName: 'e2e',
          ciTargetName: 'e2e-ci',
          testMode: 'run',
        },
      },
    ],
  });
  return task;
}

export default e2eProjectGenerator;
