import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  joinPathFragments,
  logger,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  toJS,
  Tree,
  updateJson,
  getProjects,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import {
  globalJavaScriptOverrides,
  globalTypeScriptOverrides,
} from '@nrwl/linter/src/generators/init/global-eslint-config';

import { join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';
import { filePathPrefix } from '../../utils/project-name';
import {
  cypressVersion,
  eslintPluginCypressVersion,
} from '../../utils/versions';
import { cypressInitGenerator } from '../init/init';
// app
import { Schema } from './schema';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
}

function createFiles(tree: Tree, options: CypressProjectSchema) {
  // if not installed or >v10 use v10 folder
  // else use v9 folder
  const cypressVersion = installedCypressVersion();
  const cypressFiles =
    cypressVersion && cypressVersion < 10 ? 'v9-and-under' : 'v10-and-after';

  generateFiles(
    tree,
    join(__dirname, './files', cypressFiles),
    options.projectRoot,
    {
      tmpl: '',
      ...options,
      project: options.project || 'Project',
      ext: options.js ? 'js' : 'ts',
      offsetFromRoot: offsetFromRoot(options.projectRoot),
      rootTsConfigPath: getRelativePathToRootTsConfig(
        tree,
        options.projectRoot
      ),
    }
  );

  if (cypressVersion && cypressVersion < 7) {
    updateJson(tree, join(options.projectRoot, 'cypress.json'), (json) => {
      json.pluginsFile = './src/plugins/index';
      return json;
    });
  } else if (cypressVersion < 10) {
    const pluginPath = join(options.projectRoot, 'src/plugins/index.js');
    if (tree.exists(pluginPath)) {
      tree.delete(pluginPath);
    }
  }

  if (options.js) {
    toJS(tree);
  }
}

function addProject(tree: Tree, options: CypressProjectSchema) {
  let e2eProjectConfig: ProjectConfiguration;

  const detectedCypressVersion = installedCypressVersion() ?? cypressVersion;

  const cypressConfig =
    detectedCypressVersion < 10 ? 'cypress.json' : 'cypress.config.ts';

  if (options.baseUrl) {
    e2eProjectConfig = {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: joinPathFragments(
              options.projectRoot,
              cypressConfig
            ),
            baseUrl: options.baseUrl,
            testingType: 'e2e',
          },
        },
      },
      tags: [],
      implicitDependencies: options.project ? [options.project] : undefined,
    };
  } else if (options.project) {
    const project = readProjectConfiguration(tree, options.project);

    if (!project.targets) {
      logger.warn(stripIndents`
      NOTE: Project, "${options.project}", does not have any targets defined and a baseUrl was not provided. Nx will use
      "${options.project}:serve" as the devServerTarget. But you may need to define this target within the project, "${options.project}".
      `);
    }
    const devServerTarget =
      project.targets?.serve && project.targets?.serve?.defaultConfiguration
        ? `${options.project}:serve:${project.targets.serve.defaultConfiguration}`
        : `${options.project}:serve`;
    e2eProjectConfig = {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: joinPathFragments(
              options.projectRoot,
              cypressConfig
            ),
            devServerTarget,
            testingType: 'e2e',
          },
          configurations: {
            production: {
              devServerTarget: `${options.project}:serve:production`,
            },
          },
        },
      },
      tags: [],
      implicitDependencies: options.project ? [options.project] : undefined,
    };
  } else {
    throw new Error(`Either project or baseUrl should be specified.`);
  }

  if (detectedCypressVersion < 7) {
    e2eProjectConfig.targets.e2e.options.tsConfig = joinPathFragments(
      options.projectRoot,
      'tsconfig.json'
    );
  }
  addProjectConfiguration(
    tree,
    options.projectName,
    e2eProjectConfig,
    options.standaloneConfig
  );
}

export async function addLinter(host: Tree, options: CypressProjectSchema) {
  if (options.linter === Linter.None) {
    return () => {};
  }

  const installTask = await lintProjectGenerator(host, {
    project: options.projectName,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
    eslintFilePatterns: [
      `${options.projectRoot}/**/*.${options.js ? 'js' : '{js,ts}'}`,
    ],
    setParserOptionsProject: options.setParserOptionsProject,
    skipPackageJson: options.skipPackageJson,
    rootProject: options.rootProject,
  });

  if (!options.linter || options.linter !== Linter.EsLint) {
    return installTask;
  }

  const installTask2 = !options.skipPackageJson
    ? addDependenciesToPackageJson(
        host,
        {},
        { 'eslint-plugin-cypress': eslintPluginCypressVersion }
      )
    : () => {};

  updateJson(host, join(options.projectRoot, '.eslintrc.json'), (json) => {
    if (options.rootProject) {
      json.plugins = ['@nrwl/nx'];
      json.extends = ['plugin:cypress/recommended'];
    } else {
      json.extends = ['plugin:cypress/recommended', ...json.extends];
    }
    json.overrides = [
      ...(options.rootProject
        ? [globalTypeScriptOverrides, globalJavaScriptOverrides]
        : []),
      /**
       * In order to ensure maximum efficiency when typescript-eslint generates TypeScript Programs
       * behind the scenes during lint runs, we need to make sure the project is configured to use its
       * own specific tsconfigs, and not fall back to the ones in the root of the workspace.
       */
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        /**
         * NOTE: We no longer set parserOptions.project by default when creating new projects.
         *
         * We have observed that users rarely add rules requiring type-checking to their Nx workspaces, and therefore
         * do not actually need the capabilites which parserOptions.project provides. When specifying parserOptions.project,
         * typescript-eslint needs to create full TypeScript Programs for you. When omitting it, it can perform a simple
         * parse (and AST tranformation) of the source files it encounters during a lint run, which is much faster and much
         * less memory intensive.
         *
         * In the rare case that users attempt to add rules requiring type-checking to their setup later on (and haven't set
         * parserOptions.project), the executor will attempt to look for the particular error typescript-eslint gives you
         * and provide feedback to the user.
         */
        parserOptions: !options.setParserOptionsProject
          ? undefined
          : {
              project: `${options.projectRoot}/tsconfig.*?.json`,
            },
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
    ];

    if (installedCypressVersion() < 7) {
      /**
       * We need this override because we enabled allowJS in the tsconfig to allow for JS based Cypress tests.
       * That however leads to issues with the CommonJS Cypress plugin file.
       */
      json.overrides.push({
        files: ['src/plugins/index.js'],
        rules: {
          '@typescript-eslint/no-var-requires': 'off',
          'no-undef': 'off',
        },
      });
    }

    return json;
  });

  return runTasksInSerial(installTask, installTask2);
}

export async function cypressProjectGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
  const tasks = [];
  const cypressVersion = installedCypressVersion();
  // if there is an installed cypress version, then we don't call
  // init since we want to keep the existing version that is installed
  if (!cypressVersion) {
    tasks.push(cypressInitGenerator(host, options));
  }
  createFiles(host, options);
  addProject(host, options);
  const installTask = await addLinter(host, options);
  tasks.push(installTask);
  if (!options.skipFormat) {
    await formatFiles(host);
  }
  return runTasksInSerial(...tasks);
}

function normalizeOptions(host: Tree, options: Schema): CypressProjectSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const appsDir = layoutDirectory ?? getWorkspaceLayout(host).appsDir;
  let projectName: string;
  let projectRoot: string;
  let maybeRootProject: ProjectConfiguration;
  let isRootProject = false;

  const projects = getProjects(host);
  // nx will set the project option for generators when ran within a project.
  // since the root project will always be set for standlone projects we can just check it here.
  if (options.project) {
    maybeRootProject = projects.get(options.project);
  }

  if (
    maybeRootProject?.root === '.' ||
    // should still check to see if we are in a standalone based workspace
    Array.from(projects.values()).some((config) => config.root === '.')
  ) {
    projectName = options.name;
    projectRoot = options.name;
    isRootProject = true;
  } else {
    projectName = filePathPrefix(
      projectDirectory ? `${projectDirectory}-${options.name}` : options.name
    );
    projectRoot = projectDirectory
      ? joinPathFragments(
          appsDir,
          names(projectDirectory).fileName,
          options.name
        )
      : joinPathFragments(appsDir, options.name);
  }

  options.linter = options.linter || Linter.EsLint;
  return {
    ...options,
    // other generators depend on the rootProject flag down stream
    rootProject: isRootProject,
    projectName,
    projectRoot,
  };
}

export default cypressProjectGenerator;
export const cypressProjectSchematic = convertNxGenerator(
  cypressProjectGenerator
);
