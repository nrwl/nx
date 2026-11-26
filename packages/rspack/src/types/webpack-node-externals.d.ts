declare module 'webpack-node-externals' {
  import type { ExternalItemFunctionData } from '@rspack/core';

  function nodeExternals(options?: {
    modulesDir?: string;
    allowlist?: Array<string | RegExp>;
  }): (
    data: ExternalItemFunctionData,
    callback: (err?: Error, result?: string) => void
  ) => void;

  export = nodeExternals;
}
