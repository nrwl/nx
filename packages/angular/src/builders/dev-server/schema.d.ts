interface Schema {
  buildTarget: string;
  port?: number;
  host?: string;
  proxyConfig?: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  headers?: Record<string, string>;
  open?: boolean;
  verbose?: boolean;
  liveReload?: boolean;
  publicHost?: string;
  allowedHosts?: string[];
  define?: Record<string, string>;
  servePath?: string;
  disableHostCheck?: boolean;
  hmr?: boolean;
  watch?: boolean;
  poll?: number;
  forceEsbuild?: boolean;
  inspect?: boolean | string;
  prebundle?: boolean | { exclude: string[] };
  buildLibsFromSource?: boolean;
  esbuildMiddleware?: string[];
  watchDependencies?: boolean;
}

export type NormalizedSchema = Schema & {
  liveReload: boolean;
  open: boolean;
  ssl: boolean;
};
