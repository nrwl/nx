declare module 'webpack-node-externals' {
  import type { ExternalItemFunctionData } from 'webpack';

  function nodeExternals(options?: {
    modulesDir?: string;
    allowlist?: Array<string | RegExp>;
  }): (
    data: ExternalItemFunctionData,
    callback: (err?: Error | null, result?: string) => void
  ) => void;

  export = nodeExternals;
}
