import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateModuleFederationProject } from './update-module-federation-project';

describe('updateModuleFederationProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  // A plugin-driven workspace infers its targets, so project.json carries none.
  // The guards that create `serve` must run before the executor assignment that
  // dereferences it, or this throws.
  it('should create the serve target when the project has none', () => {
    // `build` is dereferenced on the webpack path too, so it must exist for the
    // test to reach the serve guards rather than failing earlier.
    addProjectConfiguration(tree, 'shell', {
      root: 'shell',
      targets: { build: { executor: '@nx/webpack:webpack', options: {} } },
    });

    expect(() =>
      updateModuleFederationProject(
        tree,
        {
          projectName: 'shell',
          appProjectRoot: 'shell',
          port: 4201,
          bundler: 'webpack',
        },
        true
      )
    ).not.toThrow();

    expect(
      readProjectConfiguration(tree, 'shell').targets.serve.options.port
    ).toBe(4201);
  });
});
