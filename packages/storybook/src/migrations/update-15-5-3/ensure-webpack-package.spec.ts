import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, writeJson, addProjectConfiguration, Tree } from '@nx/devkit';
import update from './ensure-webpack-package';

describe('ensure-webpack-package', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: {
        '@nx/react': '15.5.0',
      },
    });
  });

  it.each`
    config
    ${'main.ts'}
    ${'main.js'}
  `(
    'should install @nx/webpack if it is needed by React project',
    async ({ config }) => {
      addProjectConfiguration(tree, 'myapp', {
        root: 'myapp',
      });
      tree.write(
        `myapp/.storybook/${config}`,
        `
        module.exports = {
          addons: ['@nx/react/plugins/storybook']
        };
      `
      );

      await update(tree);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies).toEqual({
        '@nx/react': expect.any(String),
        '@nx/webpack': expect.any(String),
      });
    }
  );

  it.each`
    config
    ${'main.ts'}
    ${'main.js'}
    ${null}
  `(
    'should not install @nx/webpack if it is not needed by React project',
    async ({ config }) => {
      addProjectConfiguration(tree, 'myapp', {
        root: 'myapp',
      });

      if (config) {
        tree.write(
          `myapp/.storybook/${config}`,
          `
          module.exports = {
            addons: []
          };
        `
        );
      }

      await update(tree);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies).toEqual({
        '@nx/react': expect.any(String),
      });
    }
  );
});
