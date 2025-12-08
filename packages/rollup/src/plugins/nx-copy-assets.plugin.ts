import { isAbsolute, join, relative } from 'node:path';
import type { Plugin } from 'rollup';
import { isDaemonEnabled, workspaceRoot } from '@nx/devkit';
import { AssetGlob } from '@nx/js/src/utils/assets/assets';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';

export interface NxCopyAssetsPluginOptions {
  assets: (string | AssetGlob)[];
  outputPath: string;
  projectRoot: string;
}

/**
 * Splits a glob into its literal directory prefix and the remaining pattern.
 * CopyAssetsHandler expects input to be a directory and glob to be a pattern
 * within it (e.g., input: 'docs', glob: '**\/*.md'), not combined paths.
 *
 * 'libs/mylib/README.md' => { prefix: 'libs/mylib', glob: 'README.md' }
 * 'docs/*.md' => { prefix: 'docs', glob: '*.md' }
 * '**\/*.md' => { prefix: '.', glob: '**\/*.md' }
 *
 * @visibleForTesting
 */
export function extractGlobLiteralPrefix(glob: string): {
  prefix: string;
  glob: string;
} {
  const parts = glob.split('/');
  const isGlobPart = (p: string) =>
    p.includes('*') || p.includes('?') || p.includes('[') || p.includes('{');

  const firstGlobIndex = parts.findIndex(isGlobPart);
  const hasGlob = firstGlobIndex !== -1;

  const prefixParts = hasGlob
    ? parts.slice(0, firstGlobIndex)
    : parts.slice(0, -1);
  const globParts = hasGlob ? parts.slice(firstGlobIndex) : parts.slice(-1);

  return {
    prefix: prefixParts.join('/') || '.',
    glob: globParts.join('/'),
  };
}

export function nxCopyAssetsPlugin(options: NxCopyAssetsPluginOptions): Plugin {
  let handler: CopyAssetsHandler;
  let dispose: () => void;

  if (global.NX_GRAPH_CREATION) return { name: 'nx-copy-assets-plugin' };

  const relativeProjectRoot = relative(workspaceRoot, options.projectRoot);

  return {
    name: 'nx-copy-assets-plugin',
    async buildStart() {
      // Input must be relative to rootDir because CopyAssetsHandler computes
      // destination paths using path.relative(input, globResult), and glob
      // returns paths relative to rootDir.
      const assets = options.assets.map((a) => {
        if (typeof a === 'string') {
          return join(relativeProjectRoot, a);
        } else {
          // relative() returns '' when paths are equal, normalize to '.'
          const relativeInput = relative(workspaceRoot, a.input) || '.';
          const { prefix: globPrefix, glob: normalizedGlob } =
            extractGlobLiteralPrefix(a.glob);

          return {
            ...a,
            input: join(relativeInput, globPrefix),
            glob: normalizedGlob,
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
