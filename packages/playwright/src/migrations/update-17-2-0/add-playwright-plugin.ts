/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tree, getProjects } from '@nx/devkit';
import { createProjectRootMappingsFromProjectConfigurations } from 'nx/src/project-graph/utils/find-project-for-path';
import { replaceProjectConfigurationsWithPlugin } from '@nx/devkit/src/utils/replace-project-configuration-with-plugin';
import { createNodes } from '../../plugins/plugin';

export default async function update(tree: Tree) {
  const proj = Object.fromEntries(getProjects(tree).entries());
  const rootMappings = createProjectRootMappingsFromProjectConfigurations(proj);

  replaceProjectConfigurationsWithPlugin(
    tree,
    rootMappings,
    '@nx/playwright/plugin',
    createNodes,
    {
      targetName: 'e2e',
    }
  );
}
