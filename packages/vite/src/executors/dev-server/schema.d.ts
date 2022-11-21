import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteDevServerExecutorOptions {
  buildTarget: string;
  proxyConfig?: string;
  port?: number;
  host?: string | boolean;
  https?: boolean;
  hmr?: boolean;
}
