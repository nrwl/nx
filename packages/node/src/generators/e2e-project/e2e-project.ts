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

export async function e2eProjectGenerator(host: Tree, options: Schema) {
  return await e2eProjectGeneratorInternal(host, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
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

  // TODO(@ndcunningham): This is broken.. the outputs are wrong.. and this isn't using the jest generator
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
  if (options.projectType === 'server') {
    generateFiles(
      host,
      path.join(__dirname, 'files/server/common'),
      options.e2eProjectRoot,
      {
        ...options,
        ...names(options.rootProject ? 'server' : options.project),
        offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
        jestPreset,
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
          offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
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
        offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
        jestPreset,
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
  Omit<Schema, 'name'> & { e2eProjectRoot: string; e2eProjectName: string }
> {
  const { projectName: e2eProjectName, projectRoot: e2eProjectRoot } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name ?? `${options.project}-e2e`,
      projectType: 'library',
      directory: options.rootProject ? 'e2e' : options.directory,
      projectNameAndRootFormat: options.rootProject
        ? 'as-provided'
        : options.projectNameAndRootFormat,
      // this is an internal generator, don't save defaults
      callingGenerator: null,
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
    port: options.port ?? 3000,
    rootProject: !!options.rootProject,
  };
}

export default e2eProjectGenerator;
