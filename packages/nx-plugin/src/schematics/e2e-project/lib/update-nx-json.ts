import { Rule } from '@angular-devkit/schematics';
import { addProjectToNxJsonInTree } from '@nrwl/workspace';
import { NxPluginE2ESchema } from '../schema';

export function updateNxJson(options: NxPluginE2ESchema): Rule {
  return addProjectToNxJsonInTree(options.projectName, {
    tags: [],
    implicitDependencies: [options.pluginName],
  });
}
