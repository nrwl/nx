interface TargetOptions {
  [key: string]: string | boolean | number | TargetOptions;
}

export interface WebSsrDevServerOptions {
  browserTarget: string;
  serverTarget: string;
  port: number;
  browserTargetOptions: TargetOptions;
  serverTargetOptions: TargetOptions;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
}
