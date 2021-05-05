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

        const config = getJestObject(
          join(appRootPath, target.options.jestConfig as string)
        );

        // migrate serializers
        if (
          config.snapshotSerializers &&
          Array.isArray(config.snapshotSerializers)
        ) {
          const snapshotSerializers = config.snapshotSerializers.map(
            (snapshotSerializer) => {
              switch (snapshotSerializer) {
                case 'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js':
                  return 'jest-preset-angular/build/serializers/no-ng-attributes';
                case 'jest-preset-angular/build/AngularSnapshotSerializer.js':
                  return 'jest-preset-angular/build/serializers/ng-snapshot';
                case 'jest-preset-angular/build/HTMLCommentSerializer.js':
                  return 'jest-preset-angular/build/serializers/html-comment';
                default:
                  return snapshotSerializer;
              }
            }
          );

          try {
            removePropertyFromJestConfig(
              host,
              target.options.jestConfig as string,
              'snapshotSerializers'
            );
            addPropertyToJestConfig(
              host,
              target.options.jestConfig as string,
              'snapshotSerializers',
              snapshotSerializers
            );
          } catch {
            context.logger.error(
              stripIndents`Unable to update snapshotSerializers for project ${projectName}.
            More information you can check online documentation https://github.com/thymikee/jest-preset-angular/blob/master/CHANGELOG.md#840-2021-03-04`
            );
          }
        }

        try {
          const setupTestPath = join(project.sourceRoot, 'test-setup.ts');
          if (host.exists(setupTestPath)) {
            const contents = host.read(setupTestPath).toString();
            host.overwrite(
              setupTestPath,
              contents.replace(
                `import 'jest-preset-angular';`,
                `import 'jest-preset-angular/setup-jest';`
              )
            );
          }
        } catch {
          context.logger.error(
            stripIndents`Unable to update test-setup.ts for project ${projectName}.`
          );
        }
      }
    }
  };
}

export default function update(): Rule {
  return chain([updateJestConfig(), formatFiles()]);
}
