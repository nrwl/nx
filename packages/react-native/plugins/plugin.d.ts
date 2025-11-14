import { CreateNodesV2 } from '@nx/devkit';
export interface ReactNativePluginOptions {
  startTargetName?: string;
  podInstallTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  buildIosTargetName?: string;
  buildAndroidTargetName?: string;
  bundleTargetName?: string;
  syncDepsTargetName?: string;
  upgradeTargetName?: string;
}
export declare const createNodes: CreateNodesV2<ReactNativePluginOptions>;
export declare const createNodesV2: CreateNodesV2<ReactNativePluginOptions>;
//# sourceMappingURL=plugin.d.ts.map
