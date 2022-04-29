import {
  getProjects,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

/**
 * Update other references to the source project's targets
 */
export function updateBuildTargets(tree: Tree, schema: NormalizedSchema) {
  getProjects(tree).forEach((projectConfig, project) => {
    Object.entries(projectConfig.targets || {}).forEach(
      ([target, targetConfig]) => {
        updateJsonValue(targetConfig, (value) => {
          const [project, target, configuration] = value.split(':');
          if (project === schema.projectName && target) {
            return configuration
              ? `${schema.newProjectName}:${target}:${configuration}`
              : `${schema.newProjectName}:${target}`;
          }
        });
      }
    );
    updateProjectConfiguration(tree, project, projectConfig);
  });
}

function updateJsonValue(
  config: TargetConfiguration,
  callback: (x: string) => void | string
) {
  function recur(obj, key, value) {
    if (typeof value === 'string') {
      const result = callback(value);
      if (result) {
        obj[key] = result;
      }
    } else if (Array.isArray(value)) {
      value.forEach((x, idx) => recur(value, idx, x));
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        recur(value, k, v);
      });
    }
  }

  Object.entries(config).forEach(([k, v]) => {
    recur(config, k, v);
  });
}
