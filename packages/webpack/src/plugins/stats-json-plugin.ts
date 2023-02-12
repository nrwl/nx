import { Compiler, sources } from 'webpack';

export class StatsJsonPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.emit.tap('StatsJsonPlugin', (compilation) => {
      const data = JSON.stringify(compilation.getStats().toJson('verbose'));
      compilation.assets[`stats.json`] = new sources.RawSource(data);
    });
  }
}
