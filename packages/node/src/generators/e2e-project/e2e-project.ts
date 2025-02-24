import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
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
  writeJson,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import {
  javaScriptOverride,
  typeScriptOverride,
} from '@nx/eslint/src/generators/init/global-eslint-config';
import * as path from 'path';
import { axiosVersion } from '../../utils/versions';
import { Schema } from './schema';
import {
  addPluginsToLintConfig,
  isEslintConfigSupported,
  replaceOverridesInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { findRootJestPreset } from '@nx/jest/src/utils/config/config-file';
import {
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { relative } from 'node:path/posix';
import { addSwcTestConfig } from '@nx/js/src/utils/swc/add-swc-config';

export async function e2eProjectGenerator(host: Tree, options: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    addPlugin: false,
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
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  // TODO(@ndcunningham): This is broken.. the outputs are wrong.. and this isn't using the jest generator
  if (isUsingTsSolutionConfig) {
    writeJson(host, joinPathFragments(options.e2eProjectRoot, 'package.json'), {
      name: options.importPath,
      version: '0.0.1',
      private: true,
      nx: {
        name: options.e2eProjectName,
        projectType: 'application',
        implicitDependencies: [options.project],
        targets: {
          e2e: {
            executor: '@nx/jest:jest',
            outputs: ['{workspaceRoot}/coverage/{e2eProjectRoot}'],
            options: {
              jestConfig: `${options.e2eProjectRoot}/jest.config.ts`,
              passWithNoTests: true,
            },
            dependsOn: [`${options.project}:build`],
          },
        },
      },
    });
  } else {
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      implicitDependencies: [options.project],
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/jest:jest',
          outputs: ['{workspaceRoot}/coverage/{e2eProjectRoot}'],
          options: {
            jestConfig: `${options.e2eProjectRoot}/jest.config.ts`,
            passWithNoTests: true,
          },
          dependsOn: [`${options.project}:build`],
        },
      },
    });
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

  const jestPreset = findRootJestPreset(host) ?? 'jest.preset.js';
  const tsConfigFile = isUsingTsSolutionConfig
    ? 'tsconfig.json'
    : 'tsconfig.spec.json';
  const rootOffset = offsetFromRoot(options.e2eProjectRoot);
  const coverageDirectory = isUsingTsSolutionConfig
    ? 'test-output/jest/coverage'
    : joinPathFragments(rootOffset, 'coverage', options.e2eProjectName);
  if (options.projectType === 'server') {
    generateFiles(
      host,
      path.join(__dirname, 'files/server/common'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        tsConfigFile,
        offsetFromRoot: rootOffset,
        jestPreset,
        coverageDirectory,
        isUsingTsSolutionConfig,
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
          ...names(options.rootProject ? 'server' : options.project),
          tsConfigFile,
          offsetFromRoot: rootOffset,
          tmpl: '',
        }
      );
    }
  } else if (options.projectType === 'cli') {
    const mainFile = appProject.targets.build?.options?.outputPath;
    generateFiles(
      host,
      path.join(__dirname, 'files/cli'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'cli' : options.project),
        mainFile,
        tsConfigFile,
        offsetFromRoot: rootOffset,
        jestPreset,
        coverageDirectory,
        isUsingTsSolutionConfig,
        tmpl: '',
      }
    );
  }

  if (isUsingTsSolutionConfig) {
    addSwcTestConfig(host, options.e2eProjectRoot, 'es6');
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

  if (options.linter === Linter.EsLint) {
    const linterTask = await lintProjectGenerator(host, {
      project: options.e2eProjectName,
      linter: Linter.EsLint,
      skipFormat: true,
      tsConfigPaths: [
        joinPathFragments(options.e2eProjectRoot, 'tsconfig.json'),
      ],
      setParserOptionsProject: false,
      skipPackageJson: false,
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
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

  if (isUsingTsSolutionConfig) {
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
  if (isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(host, options.e2eProjectRoot);
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
  }
> {
  options.directory = options.directory ?? `${options.project}-e2e`;
  const {
    projectName: e2eProjectName,
    projectRoot: e2eProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'library',
    directory: options.rootProject ? 'e2e' : options.directory,
  });

  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  return {
    addPlugin,
    ...options,
    e2eProjectRoot,
    e2eProjectName,
    importPath,
    port: options.port ?? 3000,
    rootProject: !!options.rootProject,
  };
}

export default e2eProjectGenerator;
