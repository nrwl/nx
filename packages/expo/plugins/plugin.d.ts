import { CreateNodesV2 } from '@nx/devkit';
export interface ExpoPluginOptions {
  startTargetName?: string;
  serveTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  exportTargetName?: string;
  prebuildTargetName?: string;
  installTargetName?: string;
  buildTargetName?: string;
  submitTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}
export declare const createNodes: CreateNodesV2<ExpoPluginOptions>;
export declare const createNodesV2: CreateNodesV2<ExpoPluginOptions>;
//# sourceMappingURL=plugin.d.ts.map
