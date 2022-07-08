import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
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
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';
import { filePathPrefix } from '../../utils/project-name';
import {
  cypressVersion,
  eslintPluginCypressVersion,
} from '../../utils/versions';
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
    json.extends = ['plugin:cypress/recommended', ...json.extends];
    json.overrides = [
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
  createFiles(host, options);
  addProject(host, options);
  const installTask = await addLinter(host, options);
  if (!options.skipFormat) {
    await formatFiles(host);
  }
  return installTask;
}

function normalizeOptions(host: Tree, options: Schema): CypressProjectSchema {
  const { appsDir } = getWorkspaceLayout(host);
  const projectName = filePathPrefix(
    options.directory ? `${options.directory}-${options.name}` : options.name
  );
  const projectRoot = options.directory
    ? joinPathFragments(
        appsDir,
        names(options.directory).fileName,
        options.name
      )
    : joinPathFragments(appsDir, options.name);

  options.linter = options.linter || Linter.EsLint;
  return {
    ...options,
    projectName,
    projectRoot,
  };
}

export default cypressProjectGenerator;
export const cypressProjectSchematic = convertNxGenerator(
  cypressProjectGenerator
);
