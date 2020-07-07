import { chain, Rule } from '@angular-devkit/schematics';
import { getWorkspace, updateWorkspace } from '@nrwl/workspace';
import { NxPluginE2ESchema } from '../schema';

export function updateWorkspaceJson(options: NxPluginE2ESchema): Rule {
  return chain([
    async (host, context) => {
      const workspace = await getWorkspace(host);
      workspace.projects.add({
        name: options.projectName,
        root: options.projectRoot,
        projectType: 'application',
        sourceRoot: `${options.projectRoot}/src`,
        targets: {
          e2e: {
            builder: '@nrwl/nx-plugin:e2e',
            options: {
              target: `${options.pluginName}:build`,
              npmPackageName: options.npmPackageName,
              pluginOutputPath: options.pluginOutputPath,
            },
          },
        },
      });
      return updateWorkspace(workspace);
    },
  ]);
}
