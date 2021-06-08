import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  readJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { updatePackageJson } from './update-package-json';
import { libraryGenerator } from '../../library/library';

describe('updatePackageJson', () => {
  let tree: Tree;
  let schema: Schema;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, { name: 'my-lib' });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should handle package.json not existing', async () => {
    expect(() => {
      updatePackageJson(tree, schema, projectConfig);
    }).not.toThrow();
  });

  it('should update the name', async () => {
    const packageJson = {
      name: '@proj/my-lib',
    };

    writeJson(tree, '/libs/my-destination/package.json', packageJson);

    updatePackageJson(tree, schema, projectConfig);

    expect(readJson(tree, '/libs/my-destination/package.json')).toEqual({
      ...packageJson,
      name: '@proj/my-destination',
    });
  });
});
