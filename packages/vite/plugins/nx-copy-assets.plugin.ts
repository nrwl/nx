import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import { AssetGlob } from '@nx/js/src/utils/assets/assets';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';

export function nxCopyAssetsPlugin(_assets: (string | AssetGlob)[]): Plugin {
  let config: ResolvedConfig;
  let handler: CopyAssetsHandler;
  let dispose: () => void;

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
        outputDir: join(config.root, config.build.outDir),
        assets,
      });
      if (this.meta.watchMode) {
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
