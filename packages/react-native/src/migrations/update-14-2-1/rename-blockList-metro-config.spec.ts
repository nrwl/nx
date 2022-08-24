import { addProjectConfiguration, Tree, getProjects } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './rename-blockList-metro-config';

describe('Rename blacklistRE to blockList in metro.config.js for react native apps', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/react-native:start',
          options: {
            port: 8081,
          },
        },
      },
    });
  });

  it(`should udpate metro.config.js and Rename blacklistRE to blockList`, async () => {
    tree.write(
      'apps/products/metro.config.js',
      `
const { withNxMetro } = require('@nrwl/react-native');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
  // console.log(getModulesRunBeforeMainModule);
  return withNxMetro(
    {
      transformer: {
        getTransformOptions: async () => ({
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        }),
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
      },
      resolver: {
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        resolverMainFields: ['sbmodern', 'browser', 'main'],
        blacklistRE: exclusionList([/\.\/dist\/.*/]),
      },
    },
    {
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx'
      extensions: [],
    }
  );
})();
`
    );
    await update(tree);

    expect(tree.read('apps/products/metro.config.js', 'utf-8')).toEqual(`
const { withNxMetro } = require('@nrwl/react-native');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
  // console.log(getModulesRunBeforeMainModule);
  return withNxMetro(
    {
      transformer: {
        getTransformOptions: async () => ({
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        }),
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
      },
      resolver: {
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        resolverMainFields: ['sbmodern', 'browser', 'main'],
        blockList: exclusionList([/\.\/dist\/.*/]),
      },
    },
    {
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx'
      extensions: [],
    }
  );
})();
`);
  });

  it(`should not udpate metro.config.js if blacklistRE does not exist`, async () => {
    tree.write(
      'apps/products/metro.config.js',
      `
const { withNxMetro } = require('@nrwl/react-native');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
  // console.log(getModulesRunBeforeMainModule);
  return withNxMetro(
    {
      transformer: {
        getTransformOptions: async () => ({
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        }),
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
      },
      resolver: {
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        resolverMainFields: ['sbmodern', 'browser', 'main'],
      },
    },
    {
      projectRoot: __dirname,
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx'
      extensions: [],
    }
  );
})();
`
    );
    await update(tree);

    expect(tree.read('apps/products/metro.config.js', 'utf-8')).toEqual(
      `
const { withNxMetro } = require('@nrwl/react-native');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
  // console.log(getModulesRunBeforeMainModule);
  return withNxMetro(
    {
      transformer: {
        getTransformOptions: async () => ({
          transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
          },
        }),
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
      },
      resolver: {
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        resolverMainFields: ['sbmodern', 'browser', 'main'],
      },
    },
    {
      projectRoot: __dirname,
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx'
      extensions: [],
    }
  );
})();
`
    );
  });
});
