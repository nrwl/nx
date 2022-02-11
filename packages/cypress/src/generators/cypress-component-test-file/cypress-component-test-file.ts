import {
  generateFiles,
  joinPathFragments,
  names,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { CypressComponentTestFileSchema } from './schema';
import {
  ComponentTestingProjectState,
  cypressComponentTestingState,
} from '../utils/verify-cypress-component-project';

export function cypressComponentTestFiles(
  tree: Tree,
  options: CypressComponentTestFileSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  options = normalizeOptions(options, projectConfig);

  const projectState = cypressComponentTestingState(tree, projectConfig, {
    force: false,
  });

  switch (projectState) {
    case ComponentTestingProjectState.INSTALL:
    case ComponentTestingProjectState.NO_INSTALL:
    case ComponentTestingProjectState.ALREADY_SETUP:
      // expected case, BUT cypress might not be installed just yet
      // then we'll get the Install state even if the deps _will_ be installed
      addDefaultTestFiles(tree, options);
      break;
    case ComponentTestingProjectState.UPGRADE:
      // this should only happen if the user currently has cypress < v10 installed.
      console.warn(
        'Cypress version of 10 or higher is required to create a component testing project. Install cypress v10 or higher before trying to create component tests'
      );
      break;
  }
}

export function normalizeOptions(
  options: CypressComponentTestFileSchema,
  projectConfig: ProjectConfiguration
) {
  if (options.directory) {
    return {
      ...options,
      directory: joinPathFragments(projectConfig.sourceRoot, options.directory),
    };
  }

  if (projectConfig.projectType === 'library') {
    return {
      ...options,
      directory: joinPathFragments(projectConfig.sourceRoot, 'lib'),
    };
  }

  if (
    projectConfig.projectType === 'application' &&
    options.componentType === 'next'
  ) {
    return {
      ...options,
      directory: joinPathFragments(projectConfig.sourceRoot, 'spec'),
    };
  }

  if (
    projectConfig.projectType === 'application' &&
    options.componentType === 'react'
  ) {
    return {
      ...options,
      directory: joinPathFragments(projectConfig.root, 'src', 'app'),
    };
  }

  return {
    ...options,
    directory: projectConfig.sourceRoot,
  };
}

function addDefaultTestFiles(
  tree: Tree,
  options: CypressComponentTestFileSchema
) {
  const subs = {
    ...options,
    ...names(options.name),
    ext: '',
  };

  if (options.componentType === 'react' || options.componentType === 'next') {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files', 'tsx'),
      options.directory,
      subs
    );
  }
}

export default cypressComponentTestFiles;
