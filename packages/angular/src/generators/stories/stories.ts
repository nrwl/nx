import type { Tree } from '@nrwl/devkit';
import { logger } from '@nrwl/devkit';
import { getProjectRootPath } from '@nrwl/workspace/src/utilities/project-type';
import componentCypressSpecGenerator from '../component-cypress-spec/component-cypress-spec';
import componentStoryGenerator from '../component-story/component-story';
import { getComponentsInfo } from './lib/component-info';
import { getE2EProject } from './lib/get-e2e-project';
import { getModuleFilePaths } from './lib/module-info';
import type { StoriesGeneratorOptions } from './schema';

export function angularStoriesGenerator(
  tree: Tree,
  options: StoriesGeneratorOptions
): void {
  const e2eProjectName = options.cypressProject ?? `${options.name}-e2e`;
  const e2eProject = getE2EProject(tree, e2eProjectName);
  const projectPath = getProjectRootPath(tree, options.name);
  const moduleFilePaths = getModuleFilePaths(tree, projectPath);
  const componentsInfo = getComponentsInfo(tree, moduleFilePaths, options.name);

  if (options.generateCypressSpecs && !e2eProject) {
    logger.info(
      `There was no e2e project "${e2eProjectName}" found, so cypress specs will not be generated. Pass "--cypressProject" to specify a different e2e project name.`
    );
  }

  componentsInfo.forEach((info) => {
    if (info === undefined) {
      return;
    }

    componentStoryGenerator(tree, {
      projectPath: info.moduleFolderPath,
      componentName: info.name,
      componentPath: info.path,
      componentFileName: info.componentFileName,
    });

    if (options.generateCypressSpecs && e2eProject) {
      componentCypressSpecGenerator(tree, {
        projectName: options.name,
        projectPath: info.moduleFolderPath,
        cypressProject: options.cypressProject,
        componentName: info.name,
        componentPath: info.path,
        componentFileName: info.componentFileName,
      });
    }
  });
}

export default angularStoriesGenerator;
