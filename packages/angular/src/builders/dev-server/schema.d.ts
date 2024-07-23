interface BaseSchema {
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
}

export type SchemaWithBrowserTarget = BaseSchema & {
  browserTarget: string;
};

export type SchemaWithBuildTarget = BaseSchema & {
  buildTarget: string;
};

export type Schema = SchemaWithBrowserTarget | SchemaWithBuildTarget;

export type NormalizedSchema = SchemaWithBuildTarget & {
  liveReload: boolean;
  open: boolean;
  ssl: boolean;
};
