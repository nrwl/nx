import { Configuration, RspackOptionsNormalized } from '@rspack/core';
import { SvgrOptions } from './models';

export function applyReactConfig(
  options: { svgr?: boolean | SvgrOptions },
  config: Partial<RspackOptionsNormalized | Configuration> = {}
): void {
  if (global.NX_GRAPH_CREATION) return;

  addHotReload(config);

  if (options.svgr !== false || typeof options.svgr === 'object') {
    removeSvgLoaderIfPresent(config);

    const defaultSvgrOptions = {
      svgo: false,
      titleProp: true,
      ref: true,
    };

    const svgrOptions =
      typeof options.svgr === 'object' ? options.svgr : defaultSvgrOptions;

    config.module.rules.push(
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: /url/, // *.svg?url
      },
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: { not: [/url/] }, // exclude react component if not *.svg?url
        use: [{ loader: '@svgr/webpack', options: svgrOptions }],
      }
    );
  }

  // enable rspack node api
  config.node = {
    __dirname: true,
    __filename: true,
  };
}

function removeSvgLoaderIfPresent(
  config: Partial<RspackOptionsNormalized | Configuration>
) {
  const svgLoaderIdx = config.module.rules.findIndex(
    (rule) => typeof rule === 'object' && rule.test?.toString().includes('svg')
  );
  if (svgLoaderIdx === -1) return;
  config.module.rules.splice(svgLoaderIdx, 1);
}

function addHotReload(
  config: Partial<RspackOptionsNormalized | Configuration>
) {
  const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');
  const isDev =
    process.env.NODE_ENV === 'development' || config.mode === 'development';
  if (isDev) {
    config.plugins.push(new ReactRefreshPlugin({ overlay: false }));
  }
}
