import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Schema } from '../schema';
import { updateJestConfig } from './update-jest-config';
import { libraryGenerator } from '../../library/library';

describe('updateJestConfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle jest config not existing', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateJestConfig(tree, schema, projectConfig);
  });

  it('should update the name and coverage directory', async () => {
    const jestConfig = `module.exports = {
      name: 'my-source',
      preset: '../../jest.config.js',
      coverageDirectory: '../../coverage/libs/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const jestConfigPath = '/libs/my-destination/jest.config.js';

    const rootJestConfigPath = '/jest.config.js';

    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(jestConfigPath, jestConfig);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateJestConfig(tree, schema, projectConfig);

    const jestConfigAfter = tree.read(jestConfigPath).toString();
    const rootJestConfigAfter = tree.read(rootJestConfigPath).toString();
    expect(jestConfigAfter).toContain(`name: 'my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../../coverage/libs/my-destination'`
    );

    expect(rootJestConfigAfter).not.toContain('<rootDir>/libs/my-source');
    expect(rootJestConfigAfter).toContain('<rootDir>/libs/my-destination');
  });
});
