import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Schema } from '../schema';
import { updateImplicitDependencies } from './update-implicit-dependencies';

describe('updateImplicitDepenencies', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      targets: {},
    });
    addProjectConfiguration(tree, 'my-other-lib', {
      root: 'libs/my-other-lib',
      targets: {},
      implicitDependencies: ['my-lib'],
    });
  });

  it('should update implicit dependencies onto the moved project', () => {
    updateImplicitDependencies(tree, schema);

    const { implicitDependencies } = readProjectConfiguration(
      tree,
      'my-other-lib'
    );
    expect(implicitDependencies).toEqual(['my-destination']);
  });
});
