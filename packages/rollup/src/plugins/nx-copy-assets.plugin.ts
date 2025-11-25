import { join, relative, isAbsolute } from 'node:path';
import type { Plugin } from 'rollup';
import { isDaemonEnabled, joinPathFragments, workspaceRoot } from '@nx/devkit';
import { AssetGlob } from '@nx/js/src/utils/assets/assets';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';

export interface NxCopyAssetsPluginOptions {
  assets: (string | AssetGlob)[];
  outputPath: string;
  projectRoot: string;
}

export function nxCopyAssetsPlugin(options: NxCopyAssetsPluginOptions): Plugin {
  let handler: CopyAssetsHandler;
  let dispose: () => void;

  if (global.NX_GRAPH_CREATION) return { name: 'nx-copy-assets-plugin' };

  const relativeProjectRoot = relative(workspaceRoot, options.projectRoot);

  return {
    name: 'nx-copy-assets-plugin',
    async buildStart() {
      // Assets from normalizeOptions already have absolute paths in input field.
      // CopyAssetsHandler expects paths relative to rootDir.
      const assets = options.assets.map((a) => {
        if (typeof a === 'string') {
          return isAbsolute(a) ? a : join(relativeProjectRoot, a);
        } else {
          return {
            ...a,
            input: isAbsolute(a.input) ? a.input : join(workspaceRoot, a.input),
          };
        }
      });

      const outputDir = isAbsolute(options.outputPath)
        ? options.outputPath
        : join(workspaceRoot, options.outputPath);

      handler = new CopyAssetsHandler({
        rootDir: workspaceRoot,
        projectDir: options.projectRoot,
        outputDir,
        assets,
      });

      if (this.meta.watchMode && isDaemonEnabled()) {
        dispose = await handler.watchAndProcessOnAssetChange();
      }
    },
    async writeBundle() {
      await handler.processAllAssetsOnce();
    },
    closeWatcher() {
      dispose?.();
    },
  };
}
