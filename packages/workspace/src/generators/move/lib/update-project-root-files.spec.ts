import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateProjectRootFiles } from './update-project-root-files';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateProjectRootFiles', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
      destination: 'subfolder/my-destination',
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

  it('should handle cypress configs correctly', async () => {
    const cypressConfigContents = `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { ...nxE2EPreset(__filename, { cypressDir: 'src' }) },
});
`;
    const cypressConfigPath = 'apps/my-app-e2e/cypress.config.ts';
    await libraryGenerator(tree, {
      name: 'e2e',
      root: 'e2e',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'e2e');
    tree.write(cypressConfigPath, cypressConfigContents);
    const schema: NormalizedSchema = {
      projectName: 'e2e',
      destination: 'apps/my-app-e2e',
      importPath: '@proj/e2e',
      updateImportPath: false,
      newProjectName: 'my-app-e2e',
      relativeToRootDestination: 'apps/my-app-e2e',
    };

    updateProjectRootFiles(tree, schema, projectConfig);

    const cypressConfigAfter = tree.read(cypressConfigPath, 'utf-8');
    expect(cypressConfigAfter).toContain(
      `e2e: { ...nxE2EPreset(__filename, { cypressDir: 'src' }) }`
    );
  });
});
