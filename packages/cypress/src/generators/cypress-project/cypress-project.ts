import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  readProjectConfiguration,
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
  ProjectConfiguration,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { join } from 'path';
// app
import { Schema } from './schema';
import {
  cypressVersion,
  eslintPluginCypressVersion,
} from '../../utils/versions';
import { filePathPrefix } from '../../utils/project-name';
import { installedCypressVersion } from '../../utils/cypress-version';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
}

function createFiles(tree: Tree, options: CypressProjectSchema) {
  generateFiles(tree, join(__dirname, './files'), options.projectRoot, {
    tmpl: '',
    ...options,
    project: options.project || 'Project',
    ext: options.js ? 'js' : 'ts',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  });

  const cypressVersion = installedCypressVersion();
  if (!cypressVersion || cypressVersion >= 7) {
    tree.delete(join(options.projectRoot, 'src/plugins/index.js'));
  } else {
    updateJson(tree, join(options.projectRoot, 'cypress.json'), (json) => {
      json.pluginsFile = './src/plugins/index';
      return json;
    });
  }

  if (options.js) {
    toJS(tree);
  }
}

function addProject(tree: Tree, options: CypressProjectSchema) {
  let devServerTarget: string = `${options.project}:serve`;
  if (options.project) {
    const project = readProjectConfiguration(tree, options.project);
    devServerTarget =
      project.targets.serve && project.targets.serve.defaultConfiguration
        ? `${options.project}:serve:${project.targets.serve.defaultConfiguration}`
        : devServerTarget;
  }

  const project: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'application',
    targets: {
      e2e: {
        executor: '@nrwl/cypress:cypress',
        options: {
          cypressConfig: joinPathFragments(options.projectRoot, 'cypress.json'),
          devServerTarget,
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
  const detectedCypressVersion = installedCypressVersion() ?? cypressVersion;
  if (detectedCypressVersion < 7) {
    project.targets.e2e.options.tsConfig = joinPathFragments(
      options.projectRoot,
      'tsconfig.json'
    );
  }
  addProjectConfiguration(
    tree,
    options.projectName,
    project,
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
