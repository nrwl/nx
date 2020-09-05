import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { getWorkspace, updateWorkspace } from '@nrwl/workspace';
import { NxPluginE2ESchema } from '../schema';

export function addJest(options: NxPluginE2ESchema): Rule {
  return chain([
    externalSchematic('@nrwl/jest', 'jest-project', {
      project: options.projectName,
      setupFile: 'none',
      supportTsx: false,
      skipSerializers: true,
    }),
    async (host) => {
      const workspace = await getWorkspace(host);
      const project = workspace.projects.get(options.projectName);
      const testOptions = project.targets.get('test').options;
      const e2eOptions = project.targets.get('e2e').options;
      project.targets.get('e2e').options = {
        ...e2eOptions,
        jestConfig: testOptions.jestConfig,
      };

      // remove the jest build target
      project.targets.delete('test');

      return updateWorkspace(workspace);
    },
  ]);
}
