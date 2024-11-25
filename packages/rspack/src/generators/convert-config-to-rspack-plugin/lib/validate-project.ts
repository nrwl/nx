import { ProjectConfiguration, Tree } from '@nx/devkit';

function hasAnotherRspackConfig(tree: Tree, projectRoot: string) {
  const files = tree.children(projectRoot);
  const projectJsonString = tree.read(`${projectRoot}/project.json`, 'utf-8');
  for (const file of files) {
    if (
      file !== 'rspack.config.js' &&
      file.endsWith('.js') &&
      file.includes('rspack.config') &&
      projectJsonString.includes(file) &&
      tree.exists(`${projectRoot}/rspack.config.js`)
    ) {
      return 'Cannot convert a project with multiple rspack config files. Please consolidate them into a single rspack.config.js file.';
    }
  }
}

function isNestProject(project: ProjectConfiguration) {
  for (const target in project.targets) {
    if (project.targets[target].executor === '@nx/js:node') {
      return `The project ${project.name} is using the '@nx/js:node' executor. At the moment, we do not support migrating such projects.`;
    }
  }
}

/**
 * Validates the project to ensure it can be migrated
 *
 * @param tree The virtual file system
 * @param project the project configuration object for the project
 * @returns A string if there is an error, otherwise undefined
 */
export function validateProject(tree: Tree, project: ProjectConfiguration) {
  const containsMfeExecutor = Object.keys(project.targets).some((target) => {
    return ['@nx/rspack:module-federation-dev-server'].includes(
      project.targets[target].executor
    );
  });

  if (containsMfeExecutor) {
    return `The project ${project.name} is using Module Federation. At the moment, we don't support migrating projects that use Module Federation.`;
  }

  const hasAnotherConfig = hasAnotherRspackConfig(tree, project.root);
  return hasAnotherConfig || isNestProject(project);
}
