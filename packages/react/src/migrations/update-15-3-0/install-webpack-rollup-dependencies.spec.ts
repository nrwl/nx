import { addProjectConfiguration, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { installWebpackRollupDependencies } from './install-webpack-rollup-dependencies';

describe('installWebpackRollupDependencies', () => {
  it('should install packages if webpack is used', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: { executor: '@nrwl/webpack:webpack' },
      },
    });

    await installWebpackRollupDependencies(tree);

    expect(readJson(tree, 'package.json')).toMatchObject({
      devDependencies: {
        webpack: '^5.75.0',
      },
    });
  });

  it('should install packages if rollup is used', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: { executor: '@nrwl/rollup:rollup' },
      },
    });

    await installWebpackRollupDependencies(tree);

    expect(readJson(tree, 'package.json')).toMatchObject({
      devDependencies: {
        webpack: '^5.75.0',
      },
    });
  });

  it('should not install packages if neither webpack nor rollup are used', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: { executor: '@nrwl/vite:build' },
      },
    });

    await installWebpackRollupDependencies(tree);

    expect(readJson(tree, 'package.json')).not.toMatchObject({
      devDependencies: {
        webpack: '^5.75.0',
      },
    });
  });
});
