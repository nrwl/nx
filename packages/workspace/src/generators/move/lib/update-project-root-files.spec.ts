import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateProjectRootFiles } from './update-project-root-files';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateProjectRootFiles', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update the relative root in files at the root of the project', async () => {
    const testFile = `module.exports = {
      name: 'my-source',
      preset: '../jest.config.js',
      coverageDirectory: '../coverage/my-source',
      snapshotSerializers: [
        'jest-preset-angular/AngularSnapshotSerializer.js',
        'jest-preset-angular/HTMLCommentSerializer.js'
      ]
    };`;
    const testFilePath = 'subfolder/my-destination/jest.config.js';
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');
    tree.write(testFilePath, testFile);
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      importPath: '@proj/subfolder-my-destination',
      updateImportPath: true,
      newProjectName: 'subfolder-my-destination',
      relativeToRootDestination: 'subfolder/my-destination',
    };

    updateProjectRootFiles(tree, schema, projectConfig);

    const testFileAfter = tree.read(testFilePath, 'utf-8');
    expect(testFileAfter).toContain(`preset: '../../jest.config.js'`);
    expect(testFileAfter).toContain(
      `coverageDirectory: '../../coverage/my-source'`
    );
  });
});
