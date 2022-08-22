import { cypressComponentProject } from '@nrwl/cypress';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
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
    joinPathFragments(projectConfig.root, 'cypress.config.ts')
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
      componentTestGenerator(tree, {
        projectPath: info.moduleFolderPath,
        componentName: info.name,
        componentDir: info.path,
        componentFileName: info.componentFileName,
        skipFormat: true,
      });
    }
  }
}
