import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join } from 'path';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../utils/config/legacy/update-config';
import { getJestObject } from '../update-10-0-0/require-jest-config';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

function updateAstTransformers(): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);

    for (const [projectName, project] of workspace.projects) {
      for (const [, target] of project.targets) {
        if (target.builder !== '@nrwl/jest:jest') {
          continue;
        }

        const config = getJestObject(
          join(appRootPath, target.options.jestConfig as string)
        );

        if (
          !config.globals?.['ts-jest']?.astTransformers ||
          !Array.isArray(config.globals?.['ts-jest']?.astTransformers)
        ) {
          continue;
        }

        try {
          removePropertyFromJestConfig(
            host,
            target.options.jestConfig as string,
            'globals.ts-jest.astTransformers'
          );
          addPropertyToJestConfig(
            host,
            target.options.jestConfig as string,
            'globals.ts-jest.astTransformers',
            {
              before: config.globals['ts-jest'].astTransformers,
            }
          );
        } catch {
          context.logger.error(
            stripIndents`Unable to update the AST transformers for project ${projectName}.
            Please define your custom AST transformers in a form of an object.
            More information you can check online documentation https://kulshekhar.github.io/ts-jest/user/config/astTransformers`
          );
        }
      }
    }
  };
}

export default function update(): Rule {
  return chain([
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    updateAstTransformers(),
    formatFiles(),
  ]);
}
