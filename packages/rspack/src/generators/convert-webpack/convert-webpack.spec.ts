import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration } from '@nx/devkit';
// nx-ignore-next-line
import { applicationGenerator as nestApplicationGenerator } from '@nx/nest';
import convertWebpack from './convert-webpack';

describe('Convert webpack', () => {
  describe('convert webpack config that uses plugin', () => {
    it('should convert basic nest webpack config to rspack', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await nestApplicationGenerator(tree, {
        directory: 'demo',
        e2eTestRunner: 'none',
        linter: 'none',
      });

      // ACT
      await convertWebpack(tree, { project: 'demo' });

      // ASSERT
      expect(tree.read('demo/rspack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { join } = require('path');

        module.exports = {
          output: {
            path: join(__dirname, '../dist/demo'),
            clean: true,
            ...(process.env.NODE_ENV !== 'production' && {
              devtoolModuleFilenameTemplate: '[absolute-resource-path]',
            }),
          },
          plugins: [
            new NxAppRspackPlugin({
              target: 'node',
              compiler: 'tsc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/assets'],
              optimization: false,
              outputHashing: 'none',
              generatePackageJson: true,
              sourceMap: true,
            }),
          ],
        };
        "
      `);
    });
  });

  it('should refuse projects using a Module Federation executor', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'host', {
      root: 'host',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { webpackConfig: 'host/webpack.config.ts' },
        },
        serve: { executor: '@nx/react:module-federation-dev-server' },
      },
    });
    tree.write('host/webpack.config.ts', 'export default {};');

    await expect(convertWebpack(tree, { project: 'host' })).rejects.toThrow(
      'The project host is using Module Federation.'
    );
    expect(tree.exists('host/webpack.config.ts')).toBeTruthy();
  });

  it('should refuse projects with a module-federation.config file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'remote', {
      root: 'remote',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { webpackConfig: 'remote/webpack.config.js' },
        },
      },
    });
    tree.write('remote/webpack.config.js', 'module.exports = {};');
    tree.write('remote/module-federation.config.js', 'module.exports = {};');

    await expect(convertWebpack(tree, { project: 'remote' })).rejects.toThrow(
      'The project remote is using Module Federation.'
    );
  });

  it('does not replace removed Webpack executors with removed Rspack executors', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'demo', {
      root: 'demo',
      targets: { build: { executor: '@nx/webpack:webpack' } },
    });
    tree.write('demo/webpack.config.js', 'module.exports = {};');
    const before = tree.listChanges();
    await expect(convertWebpack(tree, { project: 'demo' })).rejects.toThrow(
      'Migrate this project to @nx/webpack/plugin'
    );
    expect(tree.listChanges()).toEqual(before);
  });
});
