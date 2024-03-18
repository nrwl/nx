import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';
import update from './remove-block-list';

describe('remove-block-list', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      targets: {
        start: {
          executor: '@nx/expo:start',
        },
      },
    });
    tree.write(
      'apps/product/metro.config.js',
      `
const { withNxMetro } = require('@nx/expo');
const { getDefaultConfig } = require('@expo/metro-config');
const { mergeConfig } = require('metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    blockList: exclusionList([/^(?!.*node_modules).*\/dist\/.*/]),
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
  },
};


module.exports = withNxMetro(mergeConfig(defaultConfig, customConfig), {
  // Change this to true to see debugging info.
  // Useful if you have issues resolving modules
  debug: false,
  // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
  extensions: [],
  // Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
  watchFolders: [],
});`
    );
  });

  it('should remove blockList', async () => {
    await update(tree);
    const metroConfig = tree.read(`apps/product/metro.config.js`).toString();
    expect(metroConfig).not.toContain('blockList');
    expect(metroConfig).not.toContain('unstable_enableSymlinks');
    expect(metroConfig).not.toContain('unstable_enablePackageExports');
  });
});
