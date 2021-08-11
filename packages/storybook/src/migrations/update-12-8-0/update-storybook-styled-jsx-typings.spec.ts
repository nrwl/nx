import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addStyledJsxTypings from './update-storybook-styled-jsx-typings';

describe('Add styled-jsx typings to Storybook tsconfig', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    writeJson(tree, 'workspace.json', {
      projects: {
        ['home-ui-react']: {
          projectType: 'library',
          root: 'libs/home/ui-react',
          sourceRoot: 'libs/home/ui-react/src',
          targets: {
            storybook: {
              builder: '@nrwl/storybook:storybook',
              options: {
                uiFramework: '@storybook/react',
                port: 4400,
                config: {
                  configFolder: 'libs/home/ui-react/.storybook',
                },
              },
            },
          },
        },
      },
    });

    writeJson(tree, 'libs/home/ui-react/.storybook/tsconfig.json', {
      extends: '../tsconfig.json',
      compilerOptions: {
        emitDecoratorMetadata: true,
      },
      files: [
        '../../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
        '../../../node_modules/@nrwl/react/typings/image.d.ts',
      ],
      exclude: [
        '../**/*.spec.ts',
        '../**/*.spec.js',
        '../**/*.spec.tsx',
        '../**/*.spec.jsx',
      ],
      include: ['../src/**/*', '*.js'],
    });
  });

  it(`should add styled-jsx typings`, async () => {
    await addStyledJsxTypings(tree);

    const tsConfigContent = readJson(
      tree,
      'libs/home/ui-react/.storybook/tsconfig.json'
    );
    expect(tsConfigContent).toMatchSnapshot();
  });
});
