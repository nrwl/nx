import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateStorybookTsconfig from './fix-storybook-tsconfig';

describe('Fix Storybook TSConfig to avoid VSCode error', () => {
  let tree: Tree;

  describe('when project has valid configuration and targets', () => {
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
      await updateStorybookTsconfig(tree);

      expect(
        readJson(tree, 'libs/home/ui-react/.storybook/tsconfig.json')
      ).toMatchObject({
        extends: '../tsconfig.json',
        compilerOptions: {
          emitDecoratorMetadata: true,
          outDir: '',
        },
      });
    });
  });

  describe('when project has no targets', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();

      writeJson(tree, 'workspace.json', {
        projects: {
          ['home-ui-react']: {
            projectType: 'library',
            root: 'libs/home/ui-react',
            sourceRoot: 'libs/home/ui-react/src',
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

    it(`should not throw errors`, async () => {
      await expect(updateStorybookTsconfig(tree)).resolves.not.toThrow();
    });
  });
});
