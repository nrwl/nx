import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  getWorkspacePath,
  updateWorkspace,
} from '@nrwl/workspace';

import {
  addPropertyToJestConfig,
  getPropertyValueInJestConfig,
} from '../../utils/config';

function modifyJestConfig(
  host: Tree,
  context: SchematicContext,
  project: string,
  setupFile: string,
  jestConfig: string,
  tsConfig: string,
  isAngular: boolean
) {
  try {
    // add set up env file
    // setupFilesAfterEnv
    const existingSetupFiles = getPropertyValueInJestConfig(
      host,
      jestConfig,
      'setupFilesAfterEnv'
    );
  } catch {
    context.logger.warn(`
    Cannot update jest config for the ${project} project. 
    This is most likely caused because the jest config at ${jestConfig} it not in a expected configuration format (ie. module.exports = {}).
     `);
  }
}

function updateJestConfigForProjects() {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    for (const [projectName, projectDefinition] of workspace.projects) {
      // skip projects that do not have test
      if (!projectDefinition.targets.has('test')) {
        return;
      }

      const testTarget = projectDefinition.targets.get('test');

      // skip projects that are not using the jest builder
      if (testTarget.builder !== '@nrwl/jest:jest') {
        return;
      }

      // check if the project is angular so that we can place specific angular configs
      const isAngular = projectDefinition.targets
        .get('build')
        ?.builder.includes('@angular-devkit/build-angular');

      const setupfile = (testTarget.options?.setupFile as string) ?? '';
      const jestConfig = (testTarget.options?.jestConfig as string) ?? '';
      const tsConfig = (testTarget.options?.tsConfig as string) ?? '';
      modifyJestConfig(
        host,
        context,
        projectName,
        setupfile,
        jestConfig,
        tsConfig,
        isAngular
      );

      delete testTarget.options?.setupFile;
    }

    updateWorkspace(workspace);
  };
}

export default function update(): Rule {
  return chain([updateJestConfigForProjects(), formatFiles()]);
}
