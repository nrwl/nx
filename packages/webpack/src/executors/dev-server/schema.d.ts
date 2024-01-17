export interface WebDevServerOptions {
  host?: string;
  port?: number;
  publicHost?: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
  buildTarget: string;
  open?: boolean;
  liveReload?: boolean;
  hmr?: boolean;
  watch?: boolean;
  allowedHosts?: string;
  memoryLimit?: number;
  baseHref?: string;
}
