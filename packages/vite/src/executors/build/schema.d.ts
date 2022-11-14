import type { AssetGlob } from '@nrwl/workspace/src/utilities/assets';
import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteBuildExecutorOptions {
  outputPath?: string;
  baseHref?: string;
  proxyConfig?: string;
  tsConfig?: string;
  configFile?: string;
  assets: AssetGlob[];
  fileReplacements: FileReplacement[];
  sourcemap?: boolean | 'inline' | 'hidden';
  hmr?: boolean;
}
