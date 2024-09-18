interface TargetOptions {
  [key: string]: string | boolean | number | TargetOptions;
}

export interface RspackSsrDevServerOptions {
  browserTarget: string;
  serverTarget: string;
  port: number;
  browserTargetOptions: TargetOptions;
  serverTargetOptions: TargetOptions;
}
