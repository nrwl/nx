import type { DevRemoteDefinition } from '../../builders/utilities/module-federation';

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

export type NormalizedSchema = Schema & {
  devRemotes: DevRemoteDefinition[];
  liveReload: boolean;
  open: boolean;
  ssl: boolean;
  verbose: boolean;
};
