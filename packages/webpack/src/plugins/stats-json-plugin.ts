import type { Compiler } from 'webpack';

export class StatsJsonPlugin {
  apply(compiler: Compiler) {
    const { sources } = require('webpack') as typeof import('webpack');

    compiler.hooks.emit.tap('StatsJsonPlugin', (compilation) => {
      const data = JSON.stringify(compilation.getStats().toJson('verbose'));
      compilation.assets[`stats.json`] = new sources.RawSource(data);
    });
  }
}
