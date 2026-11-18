import { ProjectConfiguration, Tree } from '@nx/devkit';

function hasAnotherWebpackConfig(tree: Tree, projectRoot: string) {
  const files = tree.children(projectRoot);
  const projectJsonString = tree.read(`${projectRoot}/project.json`, 'utf-8');
  for (const file of files) {
    if (
      file !== 'webpack.config.js' &&
      file.endsWith('.js') &&
      file.includes('webpack.config') &&
      projectJsonString.includes(file) &&
      tree.exists(`${projectRoot}/webpack.config.js`)
    ) {
      return 'Cannot convert a project with multiple webpack config files. Please consolidate them into a single webpack.config.js file.';
    }
  }
}

/**
 * Validates the project to ensure it can be migrated
 *
 * @param tree The virtaul file system
 * @param project the project configuration object for the project
 * @returns A string if there is an error, otherwise undefined
 */
export function validateProject(tree: Tree, project: ProjectConfiguration) {
  const containsMfeExecutor = Object.keys(project.targets).some((target) => {
    return [
      '@nx/react:module-federation-dev-server',
      '@nx/angular:module-federation-dev-server',
    ].includes(project.targets[target].executor);
  });

  if (containsMfeExecutor) {
    return `The project ${project.name} is using Module Federation. At the moment, we don't support migrating projects that use Module Federation.`;
  }

  return hasAnotherWebpackConfig(tree, project.root);
}
