export interface Schema {
  host: string;
  port: number;
  ssl: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyUrl?: string;
  buildTarget: string;
  parallel: boolean;
  maxParallel?: number;
  withDeps: boolean;
  proxyOptions?: object;
  watch?: boolean;
  spa: boolean;
}
