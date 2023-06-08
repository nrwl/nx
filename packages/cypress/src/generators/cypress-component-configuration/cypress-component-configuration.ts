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
} from '@nx/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';

import {
  cypressVersion,
  cypressViteDevServerVersion,
  cypressWebpackVersion,
  htmlWebpackPluginVersion,
} from '../../utils/versions';
import { CypressComponentConfigurationSchema } from './schema';
import { addBaseCypressSetup } from '../base-setup/base-setup';

type NormalizeCTOptions = ReturnType<typeof normalizeOptions>;

export async function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const opts = normalizeOptions(options);

  const projectConfig = readProjectConfiguration(tree, opts.project);

  const installDepsTask = updateDeps(tree, opts);

  addProjectFiles(tree, projectConfig, opts);
  addTargetToProject(tree, projectConfig, opts);
  updateNxJsonConfiguration(tree);
  updateTsConfigForComponentTesting(tree, projectConfig);

  if (!opts.skipFormat) {
    await formatFiles(tree);
  }
  return () => {
    installDepsTask();
  };
}

function normalizeOptions(options: CypressComponentConfigurationSchema) {
  const cyVersion = installedCypressVersion();
  if (cyVersion && cyVersion < 10) {
    throw new Error(
      'Cypress version of 10 or higher is required to use component testing. See the migration guide to upgrade. https://nx.dev/cypress/v11-migration-guide'
    );
  }

  return {
    ...options,
    directory: options.directory ?? 'cypress',
  };
}

function updateDeps(tree: Tree, opts: NormalizeCTOptions) {
  const devDeps = {
    cypress: cypressVersion,
  };

  if (opts.bundler === 'vite') {
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
  opts: NormalizeCTOptions
) {
  addBaseCypressSetup(tree, {
    project: opts.project,
    directory: opts.directory,
  });

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      ...opts,
      projectRoot: projectConfig.root,
      offsetFromRoot: offsetFromRoot(projectConfig.root),
      ext: '',
    }
  );
}

function addTargetToProject(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  opts: NormalizeCTOptions
) {
  projectConfig.targets['component-test'] = {
    executor: '@nx/cypress:cypress',
    options: {
      cypressConfig: joinPathFragments(projectConfig.root, 'cypress.config.ts'),
      testingType: 'component',
    },
  };

  updateProjectConfiguration(tree, opts.project, projectConfig);
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
        const hasCyTsConfig = json.references.some((r) =>
          r.path.includes('./cypress/tsconfig.json')
        );
        if (!hasCyTsConfig) {
          json.references.push({ path: './cypress/tsconfig.json' });
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

export default cypressComponentConfiguration;
