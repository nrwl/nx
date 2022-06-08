import {
  getProjects,
  parseTargetString,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';

/**
 * Check whether the project to be removed has builders targetted by another project
 *
 * Throws an error if the project is in use, unless the `--forceRemove` option is used.
 *
 * @param schema The options provided to the schematic
 */
export function checkTargets(tree: Tree, schema: Schema) {
  if (schema.forceRemove) {
    return;
  }

  const errors: string[] = [];

  getProjects(tree).forEach((projectConfig, projectName) => {
    if (projectName === schema.projectName) {
      return;
    }
    Object.entries(projectConfig.targets || {}).forEach(([, targetConfig]) => {
      checkIfProjectIsUsed(targetConfig, (value) => {
        try {
          const { project } = parseTargetString(value);
          if (project === schema.projectName) {
            errors.push(`"${value}" is used by "${projectName}"`);
          }
        } catch (err) {
          /**
           * It threw because the target string was not
           * in the format of project:target:configuration
           *
           * In that case, we don't care about it.
           * So we can ignore this error.
           */
        }
      });
    });
  });

  if (errors.length > 0) {
    let message = `${schema.projectName} is still targeted by some projects:\n\n`;
    for (let error of errors) {
      message += `${error}\n`;
    }

    throw new Error(message);
  }
}

function checkIfProjectIsUsed(
  config: TargetConfiguration,
  callback: (x: string) => void | string
) {
  function recur(obj, key, value) {
    if (typeof value === 'string') {
      callback(value);
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
