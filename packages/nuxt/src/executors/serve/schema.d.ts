export interface NuxtServeExecutorOptions {
  debug?: boolean;
  dev?: boolean;
  ssr?: boolean;
  port?: number;
  host?: string;
  https?: boolean | Json;
}
