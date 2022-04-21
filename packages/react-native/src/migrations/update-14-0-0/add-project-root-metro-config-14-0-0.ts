import {
  formatFiles,
  getProjects,
  logger,
  stripIndents,
  Tree,
} from '@nrwl/devkit';

/**
 * Add projectRoot and watchFolders options in metro.config.js
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
      if (metroConfigContent.includes('projectRoot: __dirname')) {
        return;
      }
      if (metroConfigContent.includes('projectRoot')) return;
      tree.write(
        metroConfigPath,
        metroConfigContent.replace(
          'debug: ',
          'projectRoot: __dirname, watchFolders: [], debug: '
        )
      );
    } catch {
      logger.error(
        stripIndents`Unable to update ${metroConfigPath} for project ${project.root}.`
      );
    }
  });
  await formatFiles(tree);
}
