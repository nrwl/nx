import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { updateProjectRootFiles } from './update-project-root-files';
import { libraryGenerator } from '../../library/library';

describe('updateProjectRootFiles', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
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

    await libraryGenerator(tree, {
      name: 'my-source',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(testFilePath, testFile);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateProjectRootFiles(tree, schema, projectConfig);

    const testFileAfter = tree.read(testFilePath).toString();
    expect(testFileAfter).toContain(`preset: '../../../jest.config.js'`);
    expect(testFileAfter).toContain(
      `coverageDirectory: '../../../coverage/libs/my-source'`
    );
  });
});
