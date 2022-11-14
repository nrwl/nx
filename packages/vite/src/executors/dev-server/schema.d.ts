import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteDevServerExecutorOptions {
  buildTarget: string;
  baseHref?: string;
  proxyConfig?: string;
  fileReplacements: FileReplacement[];
  port?: number;
  host?: string | boolean;
  https?: boolean;
  hmr?: boolean;
}
