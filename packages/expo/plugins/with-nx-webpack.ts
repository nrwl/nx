import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { resolve } from 'path';

/**
 * This function add addtional rules to expo's webpack config to make expo web working
 */
export async function withNxWebpack(config) {
  // add additional rule to load files under libs
  const rules = config.module.rules[1]?.oneOf;
  if (rules) {
    rules.push({
      test: /\.(mjs|[jt]sx?)$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve('@nrwl/webpack/src/utils/web-babel-loader.js'),
        options: {
          presets: [
            [
              '@nrwl/react/babel',
              {
                runtime: 'automatic',
              },
            ],
          ],
        },
      },
    });
    // svg rule from https://github.com/kristerkari/react-native-svg-transformer/issues/135#issuecomment-1008310514
    rules.unshift({
      test: /\.svg$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options: {
            svgoConfig: {
              plugins: {
                cleanupAttrs: true,
                cleanupEnableBackground: true,
                cleanupIDs: true,
                cleanupListOfValues: true,
                cleanupNumericValues: true,
                collapseGroups: true,
                convertEllipseToCircle: true,
                convertPathData: true,
                convertShapeToPath: true,
                convertStyleToAttrs: true,
                convertTransform: true,
                inlineStyles: true,
                mergePaths: true,
                minifyStyles: true,
                moveElemsAttrsToGroup: true,
                moveGroupAttrsToElems: true,
                removeComments: true,
                removeDesc: true,
                removeDimensions: false,
                removeDoctype: true,
                removeEditorsNSData: true,
                removeEmptyAttrs: true,
                removeEmptyContainers: true,
                removeEmptyText: true,
                removeHiddenElems: true,
                removeMetadata: true,
                removeNonInheritableGroupAttrs: true,
                removeRasterImages: true,
                removeScriptElement: false,
                removeStyleElement: false,
                removeTitle: true,
                removeUnknownsAndDefaults: true,
                removeUnusedNS: true,
                removeUselessDefs: true,
                removeUselessStrokeAndFill: true,
                removeViewBox: false,
                removeXMLNS: true,
                removeXMLProcInst: true,
                reusePaths: true,
                sortAttrs: true,
                sortDefsChildren: true,
                convertColors: false,
              },
            },
          },
        },
      ],
    });
  }

  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const tsConfigPath = resolve('tsconfig.json');

  config.resolve.plugins.push(
    new TsconfigPathsPlugin({
      configFile: tsConfigPath,
      extensions,
    })
  );

  config.resolve.symlinks = true;
  return config;
}
