import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './update-storybook';

describe('12.4.0 - Update Storybook', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.mock('@storybook/core/package.json', () => ({
      version: '6.2.0',
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should update storybook config', async () => {
    addProjectConfiguration(tree, 'proj', {
      projectType: 'library',
      root: 'proj',
      targets: {
        storybook: {
          executor: '@nrwl/storybook:storybook',
          options: {
            uiFramework: '@storybook/angular',
            config: {
              configFolder: 'proj/.storybook',
            },
          },
        },
      },
    });
    tree.write('proj/.storybook/main.js', 'module.exports = {};');
    jest.requireMock('@storybook/core/package.json').version = '6.2.0';
    jest.mock('/virtual/proj/.storybook/main.js', () => ({}), {
      virtual: true,
    });

    await update(tree);

    expect(tree.read('proj/.storybook/main.js').toString())
      .toMatchInlineSnapshot(`
      "module.exports = {};
      module.exports.core = { ...module.exports.core, builder: 'webpack5' };"
    `);
    expect(
      readJson(tree, 'package.json').devDependencies[
        '@storybook/builder-webpack5'
      ]
    ).toEqual('6.2.0');

    // Should not do it again if run again
    jest.requireMock('/virtual/proj/.storybook/main.js').core = {
      builder: 'webpack5',
    };
    await update(tree);

    expect(tree.read('proj/.storybook/main.js').toString())
      .toMatchInlineSnapshot(`
      "module.exports = {};
      module.exports.core = { ...module.exports.core, builder: 'webpack5' };"
    `);
  });

  it('should error if storybook 5 is installed', async () => {
    addProjectConfiguration(tree, 'proj', {
      projectType: 'library',
      root: 'proj',
      targets: {
        storybook: {
          executor: '@nrwl/storybook:storybook',
          options: {
            uiFramework: '@storybook/angular',
            config: {
              configFolder: 'proj/.storybook',
            },
          },
        },
      },
    });
    tree.write('proj/.storybook/main.js', 'module.exports = {};');
    jest.requireMock('@storybook/core/package.json').version = '5.2.0';
    jest.mock('/virtual/proj/.storybook/main.js', () => ({}), {
      virtual: true,
    });

    try {
      await update(tree);
      fail('Should fail');
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(
        `"Could not migrate to Angular 12"`
      );
    }
  });

  it('should not update projects that are not angular', async () => {
    addProjectConfiguration(tree, 'proj', {
      projectType: 'library',
      root: 'proj',
      targets: {
        storybook: {
          executor: '@nrwl/storybook:storybook',
          options: {
            uiFramework: '@storybook/react',
            config: {
              configFolder: 'proj/.storybook',
            },
          },
        },
      },
    });
    tree.write('proj/.storybook/main.js', 'module.exports = {};');
    jest.requireMock('@storybook/core/package.json').version = '6.2.0';
    jest.mock('/virtual/proj/.storybook/main.js', () => ({}), {
      virtual: true,
    });

    await update(tree);

    expect(
      tree.read('proj/.storybook/main.js').toString()
    ).toMatchInlineSnapshot(`"module.exports = {};"`);
    expect(
      readJson(tree, 'package.json').devDependencies[
        '@storybook/builder-webpack5'
      ]
    ).not.toBeDefined();
  });
});
