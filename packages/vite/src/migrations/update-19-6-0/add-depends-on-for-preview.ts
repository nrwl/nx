import {
  type Tree,
  formatFiles,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { VitePreviewServerExecutorOptions } from '../../executors/preview-server/schema';

export default async function (tree: Tree) {
  forEachExecutorOptions<VitePreviewServerExecutorOptions>(
    tree,
    '@nx/vite:preview-server',
    (_, projectName, targetName) => {
      const project = readProjectConfiguration(tree, projectName);
      project.targets[targetName].dependsOn ??= [];
      if (project.targets[targetName].dependsOn.includes('build')) {
        return;
      }
      project.targets[targetName].dependsOn.push('build');
      updateProjectConfiguration(tree, projectName, project);
    }
  );

  await formatFiles(tree);
}
