import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addReactTypings from './update-storybook-react-typings';

describe('Adjust Storybook React Typings in Storybook tsconfig', () => {
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
    });
  });

  it(`should add outDir to the storybook tsconfig to avoid VSCode errors`, async () => {
    await addReactTypings(tree);

    const tsConfigContent = readJson(
      tree,
      'libs/home/ui-react/.storybook/tsconfig.json'
    );
    expect(tsConfigContent).toMatchSnapshot();
  });
});
