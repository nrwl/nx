import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../../library/library';
import { NormalizedSchema } from '../schema';
import { updatePackageJson } from './update-package-json';

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
      relativeToRootDestination: 'libs/my-destination',
    };

    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, { name: 'my-lib', standaloneConfig: false });
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
    writeJson(tree, '/libs/my-destination/package.json', packageJson);

    updatePackageJson(tree, schema);

    expect(readJson(tree, '/libs/my-destination/package.json')).toEqual({
      ...packageJson,
      name: '@proj/my-destination',
    });
  });
});
