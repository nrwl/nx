import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTree, createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateStorybookv63 from './migrate-storybook-6-3';

describe('Upgrade to Storybook v6.3', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('migrate addon-knobs registration', () => {
    beforeEach(() => {
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
          ['home-ui-angular']: {
            projectType: 'library',
            root: 'libs/home/ui-angular',
            sourceRoot: 'libs/home/ui-angular/src',
            targets: {
              storybook: {
                builder: '@nrwl/storybook:storybook',
                options: {
                  uiFramework: '@storybook/angular',
                  port: 4400,
                  config: {
                    configFolder: 'libs/home/ui-angular/.storybook',
                  },
                },
              },
            },
          },
        },
      });

      const mainJSFile = `
      module.exports = {
        stories: [],
        addons: ['@storybook/addon-knobs/register'],
      };
      `;

      tree.write('.storybook/main.js', mainJSFile);
      tree.write('libs/home/ui-angular/.storybook/main.js', mainJSFile);
      tree.write('libs/home/ui-react/.storybook/main.js', mainJSFile);

      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-knobs': '6.3.0',
        },
      });
    });

    it('should update the main config files to fix the addon-knobs registration', async () => {
      await updateStorybookv63(tree);

      const globalMainJS = tree.read('.storybook/main.js', 'utf-8');
      const angularMainJS = tree.read(
        'libs/home/ui-angular/.storybook/main.js',
        'utf-8'
      );
      const reactMainJS = tree.read(
        'libs/home/ui-react/.storybook/main.js',
        'utf-8'
      );

      const regex = /@storybook\/addon-knobs\/register/;
      expect(regex.test(globalMainJS)).toBeFalsy();
      expect(regex.test(angularMainJS)).toBeFalsy();
      expect(regex.test(reactMainJS)).toBeFalsy();

      const correctRegistrationRegex = /@storybook\/addon-knobs/;
      expect(correctRegistrationRegex.test(globalMainJS)).toBeTruthy();
      expect(correctRegistrationRegex.test(angularMainJS)).toBeTruthy();
      expect(correctRegistrationRegex.test(reactMainJS)).toBeTruthy();
    });
  });

  describe('package.json version upgrades', () => {
    it('should update storybook packages', async () => {
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/angular': '^6.0.0',
          '@storybook/react': '^6.0.0',
          '@storybook/addon-knobs': '^6.0.0',
          '@storybook/addon-controls': '^6.0.0',
        },
      });
      await updateStorybookv63(tree);

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/angular']
      ).toBe('~6.3.0');
      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/react']
      ).toBe('~6.3.0');
      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/addon-knobs']
      ).toBe('~6.3.0');
      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/addon-controls'
        ]
      ).toBe('~6.3.0');
    });

    it('should install the webpack5 packages when Angular 12 is being used', async () => {
      writeJson(tree, 'package.json', {
        dependencies: {
          '@angular/core': '12.0.0',
        },
        devDependencies: {
          '@storybook/angular': '~6.0.0',
          '@storybook/react': '^6.0.0',
          '@storybook/addon-knobs': '^6.0.0',
          '@storybook/addon-controls': '^6.0.0',
        },
      });
      await updateStorybookv63(tree);

      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/builder-webpack5'
        ]
      ).toBe('~6.3.0');
      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/manager-webpack5'
        ]
      ).toBe('~6.3.0');
    });

    it('should not install the Storybook Webpack 5 deps if not Angular 12 is being used', async () => {
      writeJson(tree, 'package.json', {
        dependencies: {
          '@angular/core': '11.0.0',
        },
        devDependencies: {
          '@storybook/angular': '^6.0.0',
          '@storybook/react': '^6.0.0',
          '@storybook/addon-knobs': '^6.0.0',
          '@storybook/addon-controls': '^6.0.0',
        },
      });
      await updateStorybookv63(tree);

      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/builder-webpack5'
        ]
      ).toBeUndefined();
      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/manager-webpack5'
        ]
      ).toBeUndefined();
    });

    it('should not update storybook packages that are below v6.x', async () => {
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/angular': '^5.3.1',
          '@storybook/react': '^5.3.1',
          '@storybook/addon-knobs': '^5.3.1',
          '@storybook/addon-controls': '^5.3.1',
        },
      });
      await updateStorybookv63(tree);

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/angular']
      ).toBe('^5.3.1');
      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/react']
      ).toBe('^5.3.1');
      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/addon-knobs']
      ).toBe('^5.3.1');
      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/addon-controls'
        ]
      ).toBe('^5.3.1');
    });
  });
});
