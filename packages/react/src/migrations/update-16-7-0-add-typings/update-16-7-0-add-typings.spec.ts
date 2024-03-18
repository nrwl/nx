import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import addTypings from './update-16-7-0-add-typings';

describe('Add typings to react projects', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update tsconfig to include react typings', async () => {
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
        serve: {
          executor: '@nx/webpack:dev-server',
        },
      },
    });
    tree.write(
      'myapp/tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
        },
      })
    );
    tree.write(
      'myapp/tsconfig.app.json',
      JSON.stringify({
        compilerOptions: {},
      })
    );

    await addTypings(tree);
    const tsconfigTypes = JSON.parse(
      tree.read('myapp/tsconfig.app.json', 'utf-8')
    );

    expect(tsconfigTypes.compilerOptions.types).toContain(
      '@nx/react/typings/cssmodule.d.ts'
    );
    expect(tsconfigTypes.compilerOptions.types).toContain(
      '@nx/react/typings/image.d.ts'
    );
  });

  it('should not update tsconfig of node app to include react typings', async () => {
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
        serve: {
          executor: '@nx/js:node',
        },
      },
    });
    tree.write(
      'myapp/tsconfig.app.json',
      JSON.stringify({
        compilerOptions: {
          types: [],
        },
      })
    );

    await addTypings(tree);
    const tsconfigTypes = JSON.parse(
      tree.read('myapp/tsconfig.app.json', 'utf-8')
    );

    expect(tsconfigTypes.compilerOptions.types).not.toContain(
      '@nx/react/typings/cssmodule.d.ts'
    );
    expect(tsconfigTypes.compilerOptions.types).not.toContain(
      '@nx/react/typings/image.d.ts'
    );
  });
});
