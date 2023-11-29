import { formatFiles, getProjects, Tree } from '@nx/devkit';
import { createNodes } from '../../plugins/plugin';

import { createProjectRootMappingsFromProjectConfigurations } from 'nx/src/project-graph/utils/find-project-for-path';
import { replaceProjectConfigurationsWithPlugin } from '@nx/devkit/src/utils/replace-project-configuration-with-plugin';

export default async function update(tree: Tree) {
  const proj = Object.fromEntries(getProjects(tree).entries());

  const rootMappings = createProjectRootMappingsFromProjectConfigurations(proj);

  // add function here to remove
  // passWithNoTests: true,
  // reportsDirectory: '../../coverage/apps/my-app',

  await replaceProjectConfigurationsWithPlugin(
    tree,
    rootMappings,
    '@nx/vite/plugin',
    createNodes,
    {
      buildTargetName: 'build',
      serveTargetName: 'serve',
      previewTargetName: 'preview',
      testTargetName: 'test',
      serveStaticTargetName: 'serve-static',
    }
  );

  await formatFiles(tree);
}
