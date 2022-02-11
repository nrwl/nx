import { CypressComponentProjectSchema } from './schema';
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
} from '@nrwl/devkit';
import {
  cypressReactVersion,
  cypressVersion,
  cypressWebpackVersion,
  swcCoreVersion,
  swcLoaderVersion,
  webpackHttpPluginVersion,
} from '../../utils/versions';

import { CYPRESS_COMPONENT_TEST_TARGET } from '../../utils/project-name';
import {
  ComponentTestingProjectState,
  cypressComponentTestingState,
} from '../utils/verify-cypress-component-project';

export async function cypressComponentProject(
  tree: Tree,
  options: CypressComponentProjectSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const cypressState = cypressComponentTestingState(tree, projectConfig, {
    force: options.force,
  });

  let installDepsTask;
  switch (cypressState) {
    case ComponentTestingProjectState.INSTALL:
      installDepsTask = updateDeps(tree, options, true);
      break;
    case ComponentTestingProjectState.NO_INSTALL:
      installDepsTask = updateDeps(tree, options, false);
      break;
    case ComponentTestingProjectState.ALREADY_SETUP:
      throw new Error(
        'The project already has a cypress component testing target. Please use the --force flag to overwrite the existing project.'
      );
    case ComponentTestingProjectState.UPGRADE:
      throw new Error(
        'Cypress version of 10 or higher is required to create a component testing project'
      );
    default:
      throw new Error(
        `Unable to determine if project is able to use Cypress component testing`
      );
  }

  addProjectFiles(tree, projectConfig, options);
  updateTSConfig(tree, projectConfig, options);
  addTargetToProject(tree, projectConfig, options);

  return () => {
    formatFiles(tree);
    installDepsTask();
  };
}

function updateDeps(
  tree: Tree,
  options: CypressComponentProjectSchema,
  shouldInstallCypress: boolean
) {
  const devDeps = {
    '@cypress/webpack-dev-server': cypressWebpackVersion,
    'html-webpack-plugin': webpackHttpPluginVersion,
  };

  if (shouldInstallCypress) {
    devDeps['cypress'] = cypressVersion;
  }

  if (options.componentType === 'react' || options.componentType === 'next') {
    devDeps['@cypress/react'] = cypressReactVersion;
    if (options.compiler === 'swc') {
      devDeps['@swc/core'] = swcCoreVersion;
      devDeps['swc-loader'] = swcLoaderVersion;
    }
  }
  return addDependenciesToPackageJson(tree, {}, devDeps);
}

function updateGitIgnore(tree: Tree) {
  let ignoreContents;

  if (tree.exists('.gitignore')) {
    const contents = tree.read('.gitignore', 'utf-8');

    if (contents.includes('.next')) {
      return;
    }
    ignoreContents = `${contents}\n.next`;
  } else {
    ignoreContents = '.next';
  }
  tree.write('.gitignore', ignoreContents);
}

function addProjectFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
) {
  // prevent overwriting the existing next.config.js
  const nextConfigPath = joinPathFragments(
    projectConfig.root,
    'next.config.js'
  );
  if (tree.exists(nextConfigPath)) {
    tree.rename(nextConfigPath, `${nextConfigPath}.bak`);
    updateGitIgnore(tree);
  }

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

  if (options.componentType !== 'next') {
    tree.delete(joinPathFragments(projectConfig.root, 'next.config.js'));
  } else {
    updateGitIgnore(tree);
  }

  if (tree.exists(`${nextConfigPath}.bak`)) {
    tree.rename(`${nextConfigPath}.bak`, nextConfigPath);
  }
}

function updateTSConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
) {
  const projectTsConfigPath = joinPathFragments(
    projectConfig.root,
    'tsconfig.json'
  );
  if (!tree.exists(projectTsConfigPath)) {
    throw new Error(
      `Expected project tsconfig.json to exist. Please create one. Expected ${projectTsConfigPath} to exist. Found none.`
    );
  }

  updateJson(tree, projectTsConfigPath, (json) => {
    json.references = json.references || [];
    json.references.push({ path: './tsconfig.cy.json' });
    return json;
  });

  // ignore the cypress files otherwise the build will fail
  // attempt to grab the tsconfig used for building
  const buildTsConfig = getTsConfig(projectConfig, options);

  if (buildTsConfig) {
    updateJson(tree, buildTsConfig, (json) => {
      json.exclude = Array.from(
        new Set([
          ...(json.exclude || []),
          'cypress/**/*',
          'cypress.config.ts',
          '**/*.cy.ts',
          '**/*.cy.js',
          '**/*.cy.tsx',
          '**/*.cy.jsx',
        ])
      );
      return json;
    });
  }
}

function getTsConfig(
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
): string {
  if (projectConfig.targets?.['build']?.options?.tsConfig) {
    return projectConfig.targets['build'].options.tsConfig;
  }

  if (projectConfig.projectType === 'library') {
    return joinPathFragments(projectConfig.root, 'tsconfig.lib.json');
  }

  if (
    projectConfig.projectType === 'application' &&
    options.componentType === 'next'
  ) {
    return joinPathFragments(projectConfig.root, 'tsconfig.json');
  }

  if (
    projectConfig.projectType === 'application' &&
    options.componentType === 'react'
  ) {
    return joinPathFragments(projectConfig.root, 'tsconfig.app.json');
  }

  // fallback to default tsconfig as that should always be there.
  return joinPathFragments(projectConfig.root, 'tsconfig.json');
}

function addTargetToProject(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentProjectSchema
) {
  projectConfig.targets[CYPRESS_COMPONENT_TEST_TARGET] = {
    executor: '@nrwl/cypress:cypress',
    options: {
      cypressConfig: joinPathFragments(projectConfig.root, 'cypress.config.ts'),
      testingType: 'component',
    },
  };

  updateProjectConfiguration(tree, options.project, projectConfig);
}
