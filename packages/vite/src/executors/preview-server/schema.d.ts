export interface VitePreviewServerExecutorOptions {
  buildTarget: string;
  proxyConfig?: string;
  port?: number;
  host?: string | boolean;
  https?: boolean | Json;
  open?: string | boolean;
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  mode?: string;
  clearScreen?: boolean;
  staticFilePath?: string;
}
