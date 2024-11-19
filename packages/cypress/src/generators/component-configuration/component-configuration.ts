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
  runTasksInSerial,
  GeneratorCallback,
  readJson,
} from '@nx/devkit';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { installedCypressVersion } from '../../utils/cypress-version';

import {
  cypressVersion,
  cypressViteDevServerVersion,
  cypressWebpackVersion,
  htmlWebpackPluginVersion,
} from '../../utils/versions';
import { CypressComponentConfigurationSchema } from './schema';
import { addBaseCypressSetup } from '../base-setup/base-setup';
import init from '../init/init';

type NormalizeCTOptions = ReturnType<typeof normalizeOptions>;

export function componentConfigurationGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  return componentConfigurationGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

export async function componentConfigurationGeneratorInternal(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  assertNotUsingTsSolutionSetup(tree, 'cypress', 'component-configuration');

  const tasks: GeneratorCallback[] = [];
  const opts = normalizeOptions(tree, options);

  tasks.push(
    await init(tree, {
      ...opts,
      skipFormat: true,
    })
  );

  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );

  const projectConfig = readProjectConfiguration(tree, opts.project);

  tasks.push(updateDeps(tree, opts));

  addProjectFiles(tree, projectConfig, opts);
  if (!hasPlugin || opts.addExplicitTargets) {
    addTargetToProject(tree, projectConfig, opts);
  }
  updateNxJsonConfiguration(tree, hasPlugin);

  updateTsConfigForComponentTesting(tree, projectConfig);

  if (!opts.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function normalizeOptions(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const cyVersion = installedCypressVersion();
  if (cyVersion && cyVersion < 10) {
    throw new Error(
      'Cypress version of 10 or higher is required to use component testing. See the migration guide to upgrade. https://nx.dev/cypress/v11-migration-guide'
    );
  }

  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  return {
    addPlugin,
    ...options,
    framework: options.framework ?? null,
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
    jsx: opts.jsx,
  });

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      ...opts,
      projectRoot: projectConfig.root,
      offsetFromRoot: offsetFromRoot(projectConfig.root),
      linter: isEslintInstalled(tree) ? 'eslint' : 'none',
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

function updateNxJsonConfiguration(tree: Tree, hasPlugin: boolean) {
  const nxJson = readNxJson(tree);

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
  if (!hasPlugin) {
    const cacheableOperations: string[] | null =
      nxJson.tasksRunnerOptions?.default?.options?.cacheableOperations;
    if (
      cacheableOperations &&
      !cacheableOperations.includes('component-test')
    ) {
      cacheableOperations.push('component-test');
    }
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['component-test'] ??= {};
    nxJson.targetDefaults['component-test'].cache ??= true;

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

function isEslintInstalled(tree: Tree): boolean {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!(dependencies?.eslint || devDependencies?.eslint);
}

export default componentConfigurationGenerator;
