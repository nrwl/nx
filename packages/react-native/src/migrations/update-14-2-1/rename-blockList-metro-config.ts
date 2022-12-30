import {
  formatFiles,
  getProjects,
  logger,
  stripIndents,
  Tree,
} from '@nrwl/devkit';

/**
 * Rename blacklistRE to blockList in metro.config.js
 * @param tree
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    const metroConfigPath = `${project.root}/metro.config.js`;
    if (
      project.targets?.start?.executor !== '@nrwl/react-native:start' ||
      !tree.exists(metroConfigPath)
    )
      return;

    try {
      const metroConfigContent = tree.read(metroConfigPath, 'utf-8');
      if (!metroConfigContent.includes('blacklistRE:')) {
        return;
      }
      tree.write(
        metroConfigPath,
        metroConfigContent.replace('blacklistRE:', 'blockList:')
      );
    } catch {
      logger.error(
        stripIndents`Unable to update ${metroConfigPath} for project ${project.root}.`
      );
    }
  });
  await formatFiles(tree);
}
