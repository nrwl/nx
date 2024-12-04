import type { DevRemoteDefinition } from '../../builders/utilities/module-federation';

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
  devRemotes?: DevRemoteDefinition[];
  skipRemotes?: string[];
  pathToManifestFile?: string;
  static?: boolean;
  isInitialHost?: boolean;
  parallel?: number;
  staticRemotesPort?: number;
  buildLibsFromSource?: boolean;
}

export type SchemaWithBrowserTarget = BaseSchema & {
  browserTarget: string;
};

export type SchemaWithBuildTarget = BaseSchema & {
  buildTarget: string;
};

export type Schema = SchemaWithBrowserTarget | SchemaWithBuildTarget;

export type NormalizedSchema = SchemaWithBuildTarget & {
  devRemotes: DevRemoteDefinition[];
  liveReload: boolean;
  open: boolean;
  ssl: boolean;
  verbose: boolean;
};
