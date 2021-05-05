import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { formatFiles, getWorkspace } from '@nrwl/workspace';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { join } from 'path';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../utils/config/legacy/update-config';

function updateJestConfig(): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);

    for (const [projectName, project] of workspace.projects) {
      for (const [, target] of project.targets) {
        if (target.builder !== '@nrwl/jest:jest') {
          continue;
        }

        const jestConfigPath = target.options.jestConfig as string;
        const config = getJestObject(join(appRootPath, jestConfigPath));
        const tsJestConfig = config.globals && config.globals['ts-jest'];

        if (!(tsJestConfig && tsJestConfig.tsConfig)) {
          continue;
        }

        try {
          removePropertyFromJestConfig(
            host,
            jestConfigPath,
            'globals.ts-jest.tsConfig'
          );
          addPropertyToJestConfig(
            host,
            jestConfigPath,
            'globals.ts-jest.tsconfig',
            tsJestConfig.tsConfig
          );
        } catch {
          context.logger.error(
            stripIndents`Unable to update jest.config.js for project ${projectName}.`
          );
        }
      }
    }
  };
}

export default function update(): Rule {
  return chain([updateJestConfig(), formatFiles()]);
}
