import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { readJsonFile } from '@nx/devkit';
import {
  toExecutorAssets,
  type AssetsJson,
} from '../../plugins/copy-assets-plugin.js';

/**
 * Drives the real copy-assets pipeline over the working tree with a collecting
 * callback in place of the copying one, so the resulting paths are the ones a
 * build would produce, without writing any of them.
 */
export function collectCopiedFiles(
  assetsJson: AssetsJson,
  projectRoot: string,
  rootDir: string
): Set<string> {
  const copied = new Set<string>();
  new CopyAssetsHandler({
    rootDir,
    projectDir: join(rootDir, projectRoot),
    outputDir: resolve(rootDir, assetsJson.outDir),
    assets: toExecutorAssets(assetsJson, projectRoot),
    callback: (events) => {
      for (const event of events) copied.add(event.dest);
    },
  }).processAllAssetsOnceSync();

  return copied;
}

export function isInside(dir: string, file: string): boolean {
  const rel = relative(dir, file);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}

/** The source and output directories a package builds with, relative to it. */
export type BuildLayout = { sourceDir: string; outDir: string };

/**
 * Reads the `rootDir`/`outDir` the package builds with. Returns null when
 * neither tsconfig declares both, so a package whose layout cannot be
 * determined is left unchecked rather than checked against a guess.
 */
export function readBuildLayout(
  projectRoot: string,
  rootDir: string
): BuildLayout | null {
  for (const tsconfig of ['tsconfig.lib.json', 'tsconfig.json']) {
    const tsconfigPath = join(rootDir, projectRoot, tsconfig);
    if (!existsSync(tsconfigPath)) continue;
    const compilerOptions = readJsonFile(tsconfigPath).compilerOptions ?? {};
    if (compilerOptions.rootDir && compilerOptions.outDir) {
      return {
        sourceDir: compilerOptions.rootDir,
        outDir: compilerOptions.outDir,
      };
    }
  }

  return null;
}
