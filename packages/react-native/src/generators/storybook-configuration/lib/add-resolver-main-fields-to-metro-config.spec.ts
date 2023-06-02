import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { formatFile } from '../../../utils/format-file';

import { addResolverMainFieldsToMetroConfig } from './add-resolver-main-fields-to-metro-config';

describe('addResolverMainFieldsToMetroConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
    });
  });

  it(`should update metro.config.js and add key projectRoot`, async () => {
    tree.write(
      'apps/products/metro.config.js',
      formatFile`
const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig } = require('metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
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
        blockList: exclusionList([/^(?!.*node_modules).*\/dist\/.*/]),
      },
    }
  );
})();`
    );
    addResolverMainFieldsToMetroConfig(tree, {
      name: 'products',
    });

    expect(
      formatFile`${tree.read('apps/products/metro.config.js', 'utf-8')}`
    ).toEqual(
      formatFile`
const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig } = require('metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();
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
        resolverMainFields: ['sbmodern', 'browser', 'main'],
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        blockList: exclusionList([/^(?!.*node_modules).*\/dist\/.*/]),
      },
    }
  );
})();`
    );
  });

  it(`should not udpate metro.config.js if projectRoot already exists`, async () => {
    tree.write(
      'apps/products/metro.config.js',
      `
const { withNxMetro } = require('@nx/react-native');
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
        resolverMainFields: ['main'],
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
      },
    },
  );
})();
`
    );
    addResolverMainFieldsToMetroConfig(tree, {
      name: 'products',
    });

    expect(tree.read('apps/products/metro.config.js', 'utf-8')).toEqual(
      `
const { withNxMetro } = require('@nx/react-native');
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
        resolverMainFields: ['main'],
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
      },
    },
  );
})();
`
    );
  });
});
