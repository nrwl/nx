import type { Compiler } from '@rspack/core';

export class StatsJsonPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.emit.tap('StatsJsonPlugin', (compilation) => {
      const sources = compiler.rspack.sources;
      const data = JSON.stringify(compilation.getStats().toJson('verbose'));
      compilation.assets[`stats.json`] = new sources.RawSource(data);
    });
  }
}
