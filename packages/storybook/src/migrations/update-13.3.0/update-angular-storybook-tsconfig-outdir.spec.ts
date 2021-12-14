import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addOutDirToAngularStorybookTsconfig from './update-angular-storybook-tsconfig-outdir';

describe('Add outdir to Storybook tsconfig when uiFramework is angular migration', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    writeJson(tree, 'workspace.json', {
      projects: {
        ['home-ui-angular']: {
          projectType: 'application',
          root: 'apps/myapps/ui-angular',
          sourceRoot: 'apps/myapps/ui-angular/src',
          targets: {
            storybook: {
              builder: '@nrwl/storybook:storybook',
              options: {
                uiFramework: '@storybook/angular',
                port: 4400,
                config: {
                  configFolder: 'apps/myapps/ui-angular/.storybook',
                },
              },
            },
          },
        },
      },
    });

    writeJson(tree, 'apps/myapps/ui-angular/.storybook/tsconfig.json', {
      extends: '../tsconfig.json',
      compilerOptions: {
        emitDecoratorMetadata: true,
        // apps/myapps/ui-angular/.storybook -> should be 4 directories up to root
        outDir: '../../../../dist/out-tsc',
      },

      exclude: ['../**/*.spec.ts'],
      include: ['../src/**/*', '*.js'],
    });
  });

  it(`should add outDir compilerOption`, async () => {
    await addOutDirToAngularStorybookTsconfig(tree);

    const tsConfigContent = readJson(
      tree,
      'apps/myapps/ui-angular/.storybook/tsconfig.json'
    );
    expect(tsConfigContent).toMatchSnapshot();
  });
});
