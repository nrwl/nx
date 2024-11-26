import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updatePackageJson } from './update-package-json';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updatePackageJson', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
  });

  it('should handle package.json not existing', async () => {
    expect(() => {
      updatePackageJson(tree, schema);
    }).not.toThrow();
  });

  it('should update the name', async () => {
    const packageJson = {
      name: '@proj/my-lib',
    };
    writeJson(tree, 'my-destination/package.json', packageJson);

    updatePackageJson(tree, schema);

    expect(readJson(tree, 'my-destination/package.json')).toEqual({
      ...packageJson,
      name: '@proj/my-destination',
    });
  });
});
