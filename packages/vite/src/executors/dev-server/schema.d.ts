export interface ViteDevServerExecutorOptions {
  buildTarget: string;
  buildLibsFromSource?: boolean;
  proxyConfig?: string;
  port?: number;
  host?: string | boolean;
  https?: boolean;
  hmr?: boolean;
  open?: string | boolean;
  cors?: boolean;
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  mode?: string;
  clearScreen?: boolean;
  force?: boolean;
}
