import { formatFiles, getProjects, Tree } from '@nx/devkit';
import { createNodes } from '../../plugins/plugin';

import { createProjectRootMappingsFromProjectConfigurations } from 'nx/src/project-graph/utils/find-project-for-path';
import { replaceProjectConfigurationsWithPlugin } from '@nx/devkit/src/utils/replace-project-configuration-with-plugin';

export default async function update(tree: Tree) {
  const proj = Object.fromEntries(getProjects(tree).entries());

  const rootMappings = createProjectRootMappingsFromProjectConfigurations(proj);

  replaceProjectConfigurationsWithPlugin(
    tree,
    rootMappings,
    '@nx/cypress/plugin',
    createNodes,
    {
      targetName: 'e2e',
      componentTestingTargetName: 'component-test',
    }
  );

  await formatFiles(tree);
}
