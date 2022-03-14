import {
  formatFiles,
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';

import { join } from 'path';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../../utils/config/update-config';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';

function updateJestConfig(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, projectName) => {
      const config = require(join(tree.root, options.jestConfig as string));

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
            tree,
            options.jestConfig as string,
            'snapshotSerializers'
          );
          addPropertyToJestConfig(
            tree,
            options.jestConfig as string,
            'snapshotSerializers',
            snapshotSerializers
          );
        } catch {
          logger.error(
            stripIndents`Unable to update snapshotSerializers for project ${projectName}.
            More information you can check online documentation https://github.com/thymikee/jest-preset-angular/blob/master/CHANGELOG.md#840-2021-03-04`
          );
        }
      }

      try {
        const { sourceRoot } = readProjectConfiguration(tree, projectName);
        const setupTestPath = join(sourceRoot, 'test-setup.ts');
        if (tree.exists(setupTestPath)) {
          const contents = tree.read(setupTestPath, 'utf-8');
          tree.write(
            setupTestPath,
            contents.replace(
              `import 'jest-preset-angular';`,
              `import 'jest-preset-angular/setup-jest';`
            )
          );
        }
      } catch {
        logger.error(
          stripIndents`Unable to update test-setup.ts for project ${projectName}.`
        );
      }
    }
  );
}

export default async function update(tree) {
  updateJestConfig(tree);
  await formatFiles(tree);
}
