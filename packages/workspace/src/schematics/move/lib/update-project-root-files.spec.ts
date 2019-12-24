import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateProjectRootFiles } from './update-project-root-files';

describe('updateProjectRootFiles Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should update the relative root in files at the root of the project', async () => {
    const testFile = `module.exports = {
      name: 'my-source',
      preset: '../../jest.config.js',
      coverageDirectory: '../../coverage/libs/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const testFilePath = '/libs/subfolder/my-destination/jest.config.js';

    tree = await runSchematic('lib', { name: 'my-source' }, tree);
    tree.create(testFilePath, testFile);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination'
    };

    tree = (await callRule(
      updateProjectRootFiles(schema),
      tree
    )) as UnitTestTree;

    const testFileAfter = tree.read(testFilePath).toString();
    expect(testFileAfter).toContain(`preset: '../../../jest.config.js'`);
    expect(testFileAfter).toContain(
      `coverageDirectory: '../../../coverage/libs/my-source'`
    );
  });
});
