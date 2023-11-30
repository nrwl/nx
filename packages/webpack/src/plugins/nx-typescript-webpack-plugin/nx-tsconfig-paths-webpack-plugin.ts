import * as path from 'path';
import { Compiler } from 'webpack';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { workspaceRoot } from '@nx/devkit';

export class NxTsconfigPathsWebpackPlugin {
  constructor(
    private options: {
      tsConfig: string;
    }
  ) {
    if (!this.options.tsConfig)
      throw new Error(
        `Missing "tsConfig" option. Set this option in your Nx webpack plugin.`
      );
  }

  apply(compiler: Compiler): void {
    const extensions = new Set([
      ...['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      ...(compiler.options?.resolve?.extensions ?? []),
    ]);
    compiler.options.resolve = {
      ...compiler.options.resolve,
      plugins: compiler.options.resolve?.plugins ?? [],
    };
    compiler.options.resolve.plugins.push(
      new TsconfigPathsPlugin({
        configFile: !path.isAbsolute(this.options.tsConfig)
          ? path.join(workspaceRoot, this.options.tsConfig)
          : this.options.tsConfig,
        extensions: Array.from(extensions),
        mainFields: ['module', 'main'],
      })
    );
  }
}
