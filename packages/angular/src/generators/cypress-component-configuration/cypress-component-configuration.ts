import { cypressComponentProject } from '@nrwl/cypress';
import { findBuildConfig } from '@nrwl/cypress/src/utils/find-target-options';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { relative } from 'path';
import { componentTestGenerator } from '../component-test/component-test';
import {
  getComponentsInfo,
  getStandaloneComponentsInfo,
} from '../utils/storybook-ast/component-info';
import { getProjectEntryPoints } from '../utils/storybook-ast/entry-point';
import { getModuleFilePaths } from '../utils/storybook-ast/module-info';
import { CypressComponentConfigSchema } from './schema';

/**
 * This is for cypress built in component testing, if you want to test with
 * storybook + cypress then use the componentCypressGenerator instead.
 */
export async function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await cypressComponentProject(tree, {
    project: options.project,
    skipFormat: true,
  });

  await updateProjectConfig(tree, options);
  addFiles(tree, projectConfig, options);
  if (options.skipFormat) {
    await formatFiles(tree);
  }
  return () => {
    installTask();
  };
}
function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigSchema
) {
  const cypressConfigPath = joinPathFragments(
    projectConfig.root,
    'cypress.config.ts'
  );

  if (tree.exists(cypressConfigPath)) {
    tree.delete(cypressConfigPath);
  }
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      tpl: '',
    }
  );

  if (options.generateTests) {
    const entryPoints = getProjectEntryPoints(tree, options.project);

    const componentInfo = [];
    for (const entryPoint of entryPoints) {
      const moduleFilePaths = getModuleFilePaths(tree, entryPoint);
      componentInfo.push(
        ...getComponentsInfo(
          tree,
          entryPoint,
          moduleFilePaths,
          options.project
        ),
        ...getStandaloneComponentsInfo(tree, entryPoint)
      );
    }

    for (const info of componentInfo) {
      if (info === undefined) {
        continue;
      }
      const componentDirFromProjectRoot = relative(
        projectConfig.root,
        joinPathFragments(info.moduleFolderPath, info.path)
      );
      componentTestGenerator(tree, {
        project: options.project,
        componentName: info.name,
        componentDir: componentDirFromProjectRoot,
        componentFileName: info.componentFileName,
        skipFormat: true,
      });
    }
  }
}

async function updateProjectConfig(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  const found = await findBuildConfig(tree, {
    project: options.project,
    buildTarget: options.buildTarget,
    validExecutorNames: new Set<string>([
      '@nrwl/angular:webpack-browser',
      '@angular-devkit/build-angular:browser',
    ]),
  });

  assertValidConfig(found?.config);

  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    skipServe: true,
    devServerTarget: found.target,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);
}

function assertValidConfig(config: unknown) {
  if (!config) {
    throw new Error(
      'Unable to find a valid build configuration. Try passing in a target for an Angular app. --build-target=<project>:<target>[:<configuration>]'
    );
  }
}

export default cypressComponentConfiguration;
