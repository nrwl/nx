import { Tree, getProjects } from '@nx/devkit';
import { join } from 'path';

/**
 * This migration updates metro.config.js to export config as a default.
 *
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/react-native:start') {
      if (tree.exists(join(config.root, 'metro.config.js'))) {
        const oldConfig = tree
          .read(join(config.root, 'metro.config.js'))
          .toString();
        tree.write(
          join(config.root, 'metro-v71.config.js'),
          oldConfigComment + oldConfig
        );
        tree.write(join(config.root, 'metro.config.js'), content);
      }
    }
  }
}

const oldConfigComment = `/**
 * Old custom configuration for React Native v0.71.
 * From @react-native/metro-config 0.72.1, it is no longer necessary to use a config function to access the complete default config.
 * Please port your custom configuration to metro.config.js.
 * Please see https://reactnative.dev/docs/metro to learn about configuration.
 */
`;

const content = `
const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

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
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
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
});
`;
