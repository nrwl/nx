import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './add-project-root-metro-config-14-0-0';

describe('Add projectRoot option in metro.config.js', () => {
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

  it(`should udpate metro.config.js and add key projectRoot`, async () => {
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
      },
    },
    {
      // Change this to true to see debugging info.
      // Useful if you have issues resolving modules
      projectRoot: __dirname, watchFolders: [], debug: false,
      // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx'
      extensions: [],
    }
  );
})();
`);
  });

  it(`should not udpate metro.config.js if projectRoot already exists`, async () => {
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
