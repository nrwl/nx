export interface Schema {
  browserTarget: string;
  serverTarget: string;
  host?: string;
  port?: number;
  progress: boolean;
  open?: boolean;
  publicHost?: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
  devRemotes?: string[];
  skipRemotes?: string[];
  verbose: boolean;
  pathToManifestFile?: string;
}
