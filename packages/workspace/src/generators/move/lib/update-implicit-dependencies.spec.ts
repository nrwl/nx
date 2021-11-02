import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateImplicitDependencies } from './update-implicit-dependencies';

describe('updateImplicitDepenencies', () => {
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
