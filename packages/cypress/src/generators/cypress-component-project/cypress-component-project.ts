import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateNxJson,
} from '@nrwl/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';

import {
  cypressVersion,
  cypressViteDevServerVersion,
  cypressWebpackVersion,
  htmlWebpackPluginVersion,
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

  const installDepsTask = updateDeps(tree, options);

  addProjectFiles(tree, projectConfig, options);
  addTargetToProject(tree, projectConfig, options);
  updateNxJsonConfiguration(tree);
  updateTsConfigForComponentTesting(tree, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
  return () => {
    installDepsTask();
  };
}

function updateDeps(tree: Tree, options: CypressComponentProjectSchema) {
  const devDeps = {
    cypress: cypressVersion,
  };

  if (options.bundler === 'vite') {
    devDeps['@cypress/vite-dev-server'] = cypressViteDevServerVersion;
  } else {
    devDeps['@cypress/webpack-dev-server'] = cypressWebpackVersion;
    devDeps['html-webpack-plugin'] = htmlWebpackPluginVersion;
  }

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

function updateNxJsonConfiguration(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.tasksRunnerOptions = {
    ...nxJson?.tasksRunnerOptions,
    default: {
      ...nxJson?.tasksRunnerOptions?.default,
      options: {
        ...nxJson?.tasksRunnerOptions?.default?.options,
        cacheableOperations: Array.from(
          new Set([
            ...(nxJson?.tasksRunnerOptions?.default?.options
              ?.cacheableOperations ?? []),
            'component-test',
          ])
        ),
      },
    },
  };

  if (nxJson.namedInputs) {
    nxJson.targetDefaults ??= {};
    const productionFileSet = nxJson.namedInputs?.production;
    if (productionFileSet) {
      nxJson.namedInputs.production = Array.from(
        new Set([
          ...productionFileSet,
          '!{projectRoot}/cypress/**/*',
          '!{projectRoot}/**/*.cy.[jt]s?(x)',
          '!{projectRoot}/cypress.config.[jt]s',
        ])
      );
    }
    nxJson.targetDefaults['component-test'] ??= {};
    nxJson.targetDefaults['component-test'].inputs ??= [
      'default',
      productionFileSet ? '^production' : '^default',
    ];
  }
  updateNxJson(tree, nxJson);
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
