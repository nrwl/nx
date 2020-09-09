import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  offsetFromRoot,
  serializeJson,
} from '@nrwl/workspace';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../../utils/config/update-config';

function updateRootJestConfig(): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);

    const rootDirs = [];
    for (const [projectName, project] of workspace.projects) {
      for (const [, target] of project.targets) {
        if (target.builder !== '@nrwl/jest:jest') {
          continue;
        }

        rootDirs.push(`<rootDir>/${project.root}`);

        try {
          addPropertyToJestConfig(
            host,
            target.options.jestConfig as string,
            'preset',
            `${offsetFromRoot(project.root)}jest.preset.js`
          );
          addPropertyToJestConfig(
            host,
            target.options.jestConfig as string,
            'displayName',
            projectName
          );
          removePropertyFromJestConfig(
            host,
            target.options.jestConfig as string,
            'name'
          );
        } catch {
          context.logger.error(
            `Unable to update the jest preset for project ${projectName}. Please manually add "@nrwl/jest/preset" as the preset.`
          );
        }
      }
    }

    if (rootDirs.length == 0) {
      return;
    } else {
      try {
        context.logger.info(`
The root jest.config.js file will be updated to include all references to each individual project's jest config. 
A new jest.preset.js file will be created that would have your existing configuration. All projects will now have this preset.
        `);

        const existingRootConfig = host
          .read('jest.config.js')
          .toString('utf-8');

        host.create('jest.preset.js', existingRootConfig);
        addPropertyToJestConfig(
          host,
          'jest.preset.js',
          'preset',
          '@nrwl/jest/preset'
        );

        host.overwrite(
          'jest.config.js',
          `
        module.exports = {
          projects: ${serializeJson(rootDirs)}
        }
        `
        );
      } catch {
        context.logger.error(`
Unable to update the root jest.config.js with projects. Please add the "projects" property to the exported jest config with the following:
${serializeJson(rootDirs)}
        `);
      }
    }
  };
}

export default function update(): Rule {
  return chain([updateRootJestConfig(), formatFiles()]);
}
