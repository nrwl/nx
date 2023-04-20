import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { writeJson, readJson, Tree, addProjectConfiguration } from '@nx/devkit';
import update from './add-style-packages';

describe('Add less and stylus if needed', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add less if used', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: {},
    });
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/next:build',
        },
      },
    });
    tree.write(
      `myapp/next.config.js`,
      `require('@nrwl/next/plugins/with-less')`
    );

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      dependencies: {},
      devDependencies: { less: '3.12.2' },
    });
  });

  it('should add stylus if used', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: {},
    });
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/next:build',
        },
      },
    });
    tree.write(
      `myapp/next.config.js`,
      `require('@nrwl/next/plugins/with-stylus')`
    );

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      dependencies: {},
      devDependencies: { stylus: '^0.55.0' },
    });
  });

  it('should not add anything if less/stylus not used by Next.js app', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: {},
    });
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/next:build',
        },
      },
    });
    tree.write(`myapp/next.config.js`, `require('@nrwl/next/plugins/with-nx')`);

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      dependencies: {},
      devDependencies: {},
    });
  });

  it('should not add anything if no Next.js apps are in workspace', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {},
      devDependencies: {},
    });
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
        },
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      dependencies: {},
      devDependencies: {},
    });
  });
});
