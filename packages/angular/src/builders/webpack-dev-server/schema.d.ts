export interface Schema {
  browserTarget: string;
  port: number;
  host: string;
  proxyConfig?: string;
  ssl: boolean;
  sslKey?: string;
  sslCert?: string;
  headers?: Record<string, string>;
  open: boolean;
  verbose?: boolean;
  liveReload: boolean;
  publicHost?: string;
  allowedHosts?: string[];
  servePath?: string;
  disableHostCheck?: boolean;
  hmr?: boolean;
  watch?: boolean;
  poll?: number;
  buildLibsFromSource?: boolean;
}
