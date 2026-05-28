import { Configuration, RspackOptionsNormalized } from '@rspack/core';

export function applyReactConfig(
  options: Record<string, any> = {},
  config: Partial<RspackOptionsNormalized | Configuration> = {}
): void {
  if (global.NX_GRAPH_CREATION) return;

  addHotReload(config);

  // enable rspack node api
  config.node = {
    __dirname: true,
    __filename: true,
  };
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
