import { getProjects, Tree, updateProjectConfiguration } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

/**
 * Update other references to the source project's targets
 */
export function updateBuildTargets(tree: Tree, schema: NormalizedSchema) {
  getProjects(tree).forEach((projectConfig, project) => {
    Object.entries(projectConfig.targets || {}).forEach(
      ([target, targetConfig]) => {
        const configString = JSON.stringify(targetConfig);
        const updated = JSON.parse(
          configString.replace(
            new RegExp(`${schema.projectName}:`, 'g'),
            `${schema.newProjectName}:`
          )
        );
        projectConfig.targets[target] = updated;
      }
    );
    updateProjectConfiguration(tree, project, projectConfig);
  });
}
