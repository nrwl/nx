import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import addTypings from './update-16-7-0-add-typings';

describe('Add typings file and remove typings from tsconfig', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add typings file', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {},
      })
    );

    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
        },
      },
    });

    await addTypings(tree);

    expect(tree.exists('myapp/src/typings/cssmodule.d.ts')).toBeTruthy();
    expect(tree.exists('myapp/src/typings/image.d.ts')).toBeTruthy();
  });
});
