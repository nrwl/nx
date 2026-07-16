/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 * - Write the ESM2022 outputs to the file system.
 * - Fake the FESM2022 outputs pointing them to the ESM2022 outputs.
 */

import { transformFromPromise } from 'ng-packagr/src/lib/graph/transform';
import type { NgEntryPoint } from 'ng-packagr/src/lib/ng-package/entry-point/entry-point';
import {
  isEntryPointInProgress,
  isPackage,
} from 'ng-packagr/src/lib/ng-package/nodes';
import type { NgPackagrOptions } from 'ng-packagr/src/lib/ng-package/options.di';
import { NgPackage } from 'ng-packagr/src/lib/ng-package/package';
import { ensureUnixPath } from 'ng-packagr/src/lib/utils/path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { createNgEntryPoint, type NgEntryPointType } from './entry-point';

async function shouldWriteFile(
  filePath: string,
  newContent: string
): Promise<boolean> {
  try {
    const existingContent = await readFile(filePath, 'utf-8');
    return existingContent !== newContent;
  } catch (error) {
    // If we can't read the existing file (including if it doesn't exist), write the new one
    return true;
  }
}

export const writeBundlesTransform = (_options: NgPackagrOptions) => {
  return transformFromPromise(async (graph) => {
    const entryPointNode = graph.find(isEntryPointInProgress());
    if (!entryPointNode) {
      return;
    }

    const entryPoint = toCustomNgEntryPoint(entryPointNode.data.entryPoint);
    entryPointNode.data.entryPoint = entryPoint;
    entryPointNode.data.destinationFiles = entryPoint.destinationFiles;

    for (const [
      path,
      outputCache,
    ] of entryPointNode.cache.outputCache.entries()) {
      const normalizedPath = normalizeEsm2022Path(path, entryPoint);
      // Declaration maps under tmp-typings land one directory up, so their
      // source paths need rebasing; maps that don't move are left untouched.
      const content = normalizedPath.endsWith('.d.ts.map')
        ? remapDeclarationMapSources(path, normalizedPath, outputCache.content)
        : outputCache.content;

      // Only write if content has changed
      if (await shouldWriteFile(normalizedPath, content)) {
        await mkdir(dirname(normalizedPath), { recursive: true });
        await writeFile(normalizedPath, content);
      }
    }
    if (
      !entryPointNode.cache.outputCache.size &&
      entryPoint.isSecondaryEntryPoint
    ) {
      await mkdir(entryPoint.destinationPath, { recursive: true });
    }

    // Update package node only when processing the primary entry point
    if (!entryPoint.isSecondaryEntryPoint) {
      const packageNode = graph.find(isPackage);
      if (packageNode) {
        packageNode.data = new NgPackage(
          packageNode.data.src,
          toCustomNgEntryPoint(packageNode.data.primary),
          packageNode.data.secondaries.map((secondary) =>
            toCustomNgEntryPoint(secondary)
          )
        );
      }
    }
  });
};

export function remapDeclarationMapSources(
  originalPath: string,
  newPath: string,
  content: string
): string {
  const originalDir = dirname(normalize(originalPath));
  const newDir = dirname(normalize(newPath));
  if (originalDir === newDir) {
    return content;
  }

  let map: { sources?: unknown; sourceRoot?: unknown };
  try {
    map = JSON.parse(content);
  } catch {
    return content;
  }
  if (!map || typeof map !== 'object' || !Array.isArray(map.sources)) {
    return content;
  }
  // ng-packagr forces `sourceRoot: ''`, so sources are relative to the map file.
  // A map with a sourceRoot resolves its sources against that instead, so leave it be.
  if (map.sourceRoot) {
    return content;
  }

  map.sources = map.sources.map((source) =>
    typeof source === 'string'
      ? ensureUnixPath(relative(newDir, resolve(originalDir, source)))
      : source
  );

  return JSON.stringify(map);
}

function normalizeEsm2022Path(
  path: string,
  entryPoint: NgEntryPointType
): string {
  const normalizedPath = normalize(path);
  if (!entryPoint.primaryDestinationPath) {
    return normalizedPath;
  }

  if (
    normalizedPath.startsWith(
      join(entryPoint.primaryDestinationPath, 'tmp-esm2022')
    )
  ) {
    return normalizedPath.replace('tmp-esm2022', 'esm2022');
  }

  if (
    normalizedPath.startsWith(
      join(entryPoint.primaryDestinationPath, 'tmp-typings')
    )
  ) {
    return normalizedPath.replace('tmp-typings', '');
  }

  return normalizedPath;
}

function toCustomNgEntryPoint(entryPoint: NgEntryPoint): NgEntryPointType {
  return createNgEntryPoint(
    entryPoint.packageJson,
    entryPoint.ngPackageJson,
    entryPoint.basePath,
    // @ts-expect-error this is a TS private property, but it can be accessed at runtime
    entryPoint.secondaryData
  );
}
