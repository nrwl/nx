import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { join } from 'path';
// app
import { Schema } from './schema';
import { eslintPluginCypressVersion } from '../../utils/versions';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
}

function createFiles(host: Tree, options: CypressProjectSchema) {
  generateFiles(host, join(__dirname, './files'), options.projectRoot, {
    tmpl: '',
    ...options,
    project: options.project || 'Project',
    ext: options.js ? 'js' : 'ts',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  });

  if (options.js) {
    toJS(host);
  }
}

function addProject(host: Tree, options: CypressProjectSchema) {
  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'application',
    targets: {
      e2e: {
        executor: '@nrwl/cypress:cypress',
        options: {
          cypressConfig: joinPathFragments(options.projectRoot, 'cypress.json'),
          tsConfig: joinPathFragments(options.projectRoot, 'tsconfig.e2e.json'),
          devServerTarget: `${options.project}:serve`,
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
  });
}

export async function addLinter(host: Tree, options: CypressProjectSchema) {
  const installTask = await lintProjectGenerator(host, {
    project: options.projectName,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.e2e.json'),
    ],
    eslintFilePatterns: [
      `${options.projectRoot}/**/*.${options.js ? 'js' : '{js,ts}'}`,
    ],
  });

  if (!options.linter || options.linter !== Linter.EsLint) {
    return installTask;
  }

  const installTask2 = addDependenciesToPackageJson(
    host,
    {},
    { 'eslint-plugin-cypress': eslintPluginCypressVersion }
  );

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
        parserOptions: {
          project: `${options.projectRoot}/tsconfig.*?.json`,
        },
        /**
         * Having an empty rules object present makes it more obvious to the user where they would
         * extend things from if they needed to
         */
        rules: {},
      },
      /**
       * We need this override because we enabled allowJS in the tsconfig to allow for JS based Cypress tests.
       * That however leads to issues with the CommonJS Cypress plugin file.
       */
      {
        files: ['src/plugins/index.js'],
        rules: {
          '@typescript-eslint/no-var-requires': 'off',
          'no-undef': 'off',
        },
      },
    ];

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
  const projectName = options.directory
    ? names(options.directory).fileName + '-' + options.name
    : options.name;
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
