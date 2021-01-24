import { getProjects, Tree } from '@nrwl/devkit';
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

  const usedIn = [];
  getProjects(tree).forEach((project, projectName) => {
    const findTarget = new RegExp(`${schema.projectName}:`);

    if (projectName === schema.projectName) {
      return;
    }

    if (findTarget.test(JSON.stringify(project))) {
      usedIn.push(projectName);
    }
  });

  if (usedIn.length > 0) {
    let message = `${schema.projectName} is still targeted by the following projects:\n\n`;
    for (let project of usedIn) {
      message += `${project}\n`;
    }

    throw new Error(message);
  }
}
