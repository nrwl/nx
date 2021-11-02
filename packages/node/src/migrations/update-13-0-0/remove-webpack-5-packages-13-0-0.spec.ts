import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import subject from './remove-webpack-5-packages-13-0-0';

describe('Migration: Remove webpack 5 packages from Nx12', () => {
  const webpack5Packages = {
    webpack: '^5.0.0',
    'copy-webpack-plugin': '1.0.0',
    'webpack-merge': '1.0.0',
    'webpack-node-externals': '1.0.0',
    'mini-css-extract-plugin': '1.0.0',
    'source-map-loader': '1.0.0',
    'terser-webpack-plugin': '1.0.0',
    'webpack-dev-server': '1.0.0',
    'webpack-sources': '1.0.0',
    'react-refresh': '1.0.0',
    '@pmmmwh/react-refresh-webpack-plugin': '1.0.0',
  };

  it.each`
    version
    ${'5.0.0'}
    ${'~5.0.0'}
    ${'^5.0.0'}
  `(
    `should remove packages installed via webpack5 generator`,
    async ({ version }) => {
      let tree = createTreeWithEmptyWorkspace();

      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: {
            react: '17.0.0',
          },
          devDependencies: {
            lodash: '1.0.0',
            ...webpack5Packages,
            webpack: version,
          },
        })
      );

      await subject(tree);

      expect(readJson(tree, 'package.json')).toEqual({
        dependencies: {
          react: '17.0.0',
        },
        devDependencies: {
          lodash: '1.0.0',
        },
      });
    }
  );

  it.each`
    version
    ${'4.0.0'}
    ${'50.0.0'}
  `(
    `should not do anything if the webpack version is not 5`,
    async ({ version }) => {
      let tree = createTreeWithEmptyWorkspace();

      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: {
            react: '17.0.0',
          },
          devDependencies: {
            lodash: '1.0.0',
            ...webpack5Packages,
            webpack: version,
          },
        })
      );

      await subject(tree);

      expect(readJson(tree, 'package.json')).toEqual({
        dependencies: {
          react: '17.0.0',
        },
        devDependencies: {
          lodash: '1.0.0',
          ...webpack5Packages,
          webpack: version,
        },
      });
    }
  );

  it(`should not remove packages not every expected package is installed`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {
          react: '17.0.0',
        },
        devDependencies: {
          lodash: '1.0.0',
          webpack: '^5.0.0',
          'copy-webpack-plugin': '1.0.0',
        },
      })
    );

    await subject(tree);

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        react: '17.0.0',
      },
      devDependencies: {
        lodash: '1.0.0',
        webpack: '^5.0.0',
        'copy-webpack-plugin': '1.0.0',
      },
    });
  });
});
