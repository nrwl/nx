import {
  RspackPluginInstance,
  RuleSetRule,
  SourceMapDevToolPlugin,
} from '@rspack/core';
import type { SourceMap } from '../../models';
import { DevToolsIgnorePlugin } from '../../plugins/tools/dev-tools-ignore-plugin';

export function configureSourceMap(sourceMap: SourceMap) {
  const { scripts, styles, hidden, vendor } = sourceMap;

  const sourceMapRules: RuleSetRule[] = [];
  const sourceMapPlugins: RspackPluginInstance[] = [];

  if (scripts || styles) {
    const include: RegExp[] = [];
    if (scripts) {
      include.push(/js$/);
    }

    if (styles) {
      include.push(/css$/);
    }

    sourceMapPlugins.push(new DevToolsIgnorePlugin());

    sourceMapPlugins.push(
      new SourceMapDevToolPlugin({
        filename: '[file].map',
        include,
        // We want to set sourceRoot to  `webpack:///` for non
        // inline sourcemaps as otherwise paths to sourcemaps will be broken in browser
        // `webpack:///` is needed for Visual Studio breakpoints to work properly as currently
        // there is no way to set the 'webRoot'
        sourceRoot: 'webpack:///',
        moduleFilenameTemplate: '[resource-path]',
        append: hidden ? false : undefined,
      })
    );

    sourceMapRules.push({
      test: /\.[cm]?jsx?$/,
      enforce: 'pre',
      loader: require.resolve('source-map-loader'),
      options: {
        filterSourceMappingUrl: (_mapUri: string, resourcePath: string) => {
          if (vendor) {
            // Consume all sourcemaps when vendor option is enabled.
            return true;
          }

          // Don't consume sourcemaps in node_modules when vendor is disabled.
          // But, do consume local libraries sourcemaps.
          return !resourcePath.includes('node_modules');
        },
      },
    });
  }

  return { sourceMapRules, sourceMapPlugins };
}
