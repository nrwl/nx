import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { updateTsconfig } from './update-tsconfig';
import { libraryGenerator } from '../../library/library';

describe('updateTsconfig', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };
  });

  it('should delete project ref from the root tsconfig.base.json', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    updateTsconfig(tree, schema, project);

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({});
  });

  it('should delete project ref from the root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    updateTsconfig(tree, schema, project);

    const tsConfig = readJson(tree, '/tsconfig.json');
    expect(tsConfig.compilerOptions.paths).toEqual({});
  });
});
