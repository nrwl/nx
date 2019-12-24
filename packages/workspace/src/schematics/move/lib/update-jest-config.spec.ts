import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateJestConfig } from './update-jest-config';

describe('updateJestConfig Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should handle jest config not existing', async () => {
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination'
    };

    await expect(
      callRule(updateJestConfig(schema), tree)
    ).resolves.not.toThrow();
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

    tree = await runSchematic('lib', { name: 'my-source' }, tree);
    tree.create(jestConfigPath, jestConfig);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination'
    };

    tree = (await callRule(updateJestConfig(schema), tree)) as UnitTestTree;

    const jestConfigAfter = tree.read(jestConfigPath).toString();
    expect(jestConfigAfter).toContain(`name: 'my-destination'`);
    expect(jestConfigAfter).toContain(
      `coverageDirectory: '../../coverage/libs/my-destination'`
    );
  });
});
