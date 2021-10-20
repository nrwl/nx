export interface Schema {
  host: string;
  port: number;
  ssl: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyUrl?: string;
  secure?: boolean;
  buildTarget: string;
  parallel: boolean;
  maxParallel?: number;
  withDeps: boolean;
}
