import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  NxConfig,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';

import {
  cypressVersion,
  cypressWebpackVersion,
  webpackHttpPluginVersion,
} from '../../utils/versions';
import { CypressComponentProjectSchema } from './schema';

export async function cypressComponentProject(
  tree: Tree,
  options: CypressComponentProjectSchema
) {
  const cyVersion = installedCypressVersion();
  if (cyVersion && cyVersion < 10) {
    throw new Error(
      'Cypress version of 10 or higher is required to use component testing. See the migration guide to upgrade. https://nx.dev/cypress/v10-migration-guide'
    );
  }

  const projectConfig = readProjectConfiguration(tree, options.project);

  const installDepsTask = updateDeps(tree);

  addProjectFiles(tree, projectConfig, options);
  addTargetToProject(tree, projectConfig, options);
  updateNxJson(tree);
  updateTsConfigForComponentTesting(tree, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
  return () => {
    installDepsTask();
  };
}

function updateDeps(tree: Tree) {
  const devDeps = {
    '@cypress/webpack-dev-server': cypressWebpackVersion,
    'html-webpack-plugin': webpackHttpPluginVersion,
    cypress: cypressVersion,
  };

  return addDependenciesToPackageJson(tree, {}, devDeps);
}

function addProjectFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
) {
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      ...options,
      projectRoot: projectConfig.root,
      offsetFromRoot: offsetFromRoot(projectConfig.root),
      ext: '',
    }
  );
}

function addTargetToProject(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
) {
  projectConfig.targets['component-test'] = {
    executor: '@nrwl/cypress:cypress',
    options: {
      cypressConfig: joinPathFragments(projectConfig.root, 'cypress.config.ts'),
      testingType: 'component',
    },
  };

  updateProjectConfiguration(tree, options.project, projectConfig);
}

function updateNxJson(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);
  workspaceConfiguration.tasksRunnerOptions = {
    ...workspaceConfiguration?.tasksRunnerOptions,
    default: {
      ...workspaceConfiguration?.tasksRunnerOptions?.default,
      options: {
        ...workspaceConfiguration?.tasksRunnerOptions?.default?.options,
        cacheableOperations: Array.from(
          new Set([
            ...(workspaceConfiguration?.tasksRunnerOptions?.default?.options
              ?.cacheableOperations ?? []),
            'component-test',
          ])
        ),
      },
    },
  };

  if (workspaceConfiguration.namedInputs) {
    workspaceConfiguration.targetDefaults ??= {};
    const productionFileSet = workspaceConfiguration.namedInputs?.production;
    if (productionFileSet) {
      workspaceConfiguration.namedInputs.production = Array.from(
        new Set([
          ...productionFileSet,
          '!{projectRoot}/cypress/**/*',
          '!{projectRoot}/**/*.cy.[jt]s?(x)',
          '!{projectRoot}/cypress.config.[jt]s',
        ])
      );
    }
    workspaceConfiguration.targetDefaults['component-test'] ??= {};
    workspaceConfiguration.targetDefaults['component-test'].inputs ??= [
      'default',
      productionFileSet ? '^production' : '^default',
    ];
  }
  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

export function updateTsConfigForComponentTesting(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  const tsConfigPath = joinPathFragments(
    projectConfig.root,
    projectConfig.projectType === 'library'
      ? 'tsconfig.lib.json'
      : 'tsconfig.app.json'
  );
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (json) => {
      const excluded = new Set([
        ...(json.exclude || []),
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ]);

      json.exclude = Array.from(excluded);
      return json;
    });
  }

  const projectBaseTsConfig = joinPathFragments(
    projectConfig.root,
    'tsconfig.json'
  );
  if (tree.exists(projectBaseTsConfig)) {
    updateJson(tree, projectBaseTsConfig, (json) => {
      if (json.references) {
        const hasCyTsConfig = json.references.some(
          (r) => r.path === './cypress/tsconfig.cy.json'
        );
        if (!hasCyTsConfig) {
          json.references.push({ path: './cypress/tsconfig.cy.json' });
        }
      } else {
        const excluded = new Set([
          ...(json.exclude || []),
          'cypress/**/*',
          'cypress.config.ts',
          '**/*.cy.ts',
          '**/*.cy.js',
          '**/*.cy.tsx',
          '**/*.cy.jsx',
        ]);

        json.exclude = Array.from(excluded);
      }
      return json;
    });
  }
}
