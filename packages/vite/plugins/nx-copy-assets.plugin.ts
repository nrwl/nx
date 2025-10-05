import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { isDaemonEnabled, joinPathFragments, workspaceRoot } from '@nx/devkit';
import { AssetGlob } from '@nx/js/src/utils/assets/assets';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';

export function nxCopyAssetsPlugin(_assets: (string | AssetGlob)[]): Plugin {
  let config: ResolvedConfig;
  let handler: CopyAssetsHandler;
  let dispose: () => void;

  if (global.NX_GRAPH_CREATION) return;

  return {
    name: 'nx-copy-assets-plugin',
    configResolved(_config) {
      config = _config;
    },
    async buildStart() {
      const relativeProjectRoot = relative(workspaceRoot, config.root);
      const assets = _assets.map((a) => {
        if (typeof a === 'string') {
          return joinPathFragments(relativeProjectRoot, a);
        } else {
          return {
            ...a,
            input: joinPathFragments(relativeProjectRoot, a.input),
          };
        }
      });
      handler = new CopyAssetsHandler({
        rootDir: workspaceRoot,
        projectDir: config.root,
        outputDir: config.build.outDir.startsWith(config.root)
          ? config.build.outDir
          : join(config.root, config.build.outDir),
        assets,
      });
      if (this.meta.watchMode && isDaemonEnabled()) {
        dispose = await handler.watchAndProcessOnAssetChange();
      }
    },
    async writeBundle() {
      await handler.processAllAssetsOnce();
    },
    async closeWatcher() {
      dispose == null ? void 0 : dispose();
    },
  };
}
