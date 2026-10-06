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
  byEntryPoint,
  isEntryPointInProgress,
  isPackage,
} from 'ng-packagr/src/lib/ng-package/nodes';
import type { NgPackagrOptions } from 'ng-packagr/src/lib/ng-package/options.di';
import { NgPackage } from 'ng-packagr/src/lib/ng-package/package';
import { ensureUnixPath } from 'ng-packagr/src/lib/utils/path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
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

    // ngc builds the flat module file in memory and never writes it to disk, so
    // the declaration map emitted for it points at a source that doesn't exist.
    const flatModuleDeclarations = normalize(
      entryPointNode.data.destinationFiles.declarations
    );
    const flatModuleDeclarationsMap = `${flatModuleDeclarations}.map`;

    for (const [
      path,
      outputCache,
    ] of entryPointNode.cache.outputCache.entries()) {
      const originalPath = normalize(path);
      if (originalPath === flatModuleDeclarationsMap) {
        continue;
      }

      const normalizedPath = normalizeEsm2022Path(path, entryPoint);
      let content = outputCache.content;
      if (originalPath === flatModuleDeclarations) {
        // its declaration map is dropped above, so don't leave a reference behind
        content = removeSourceMappingUrl(content);
      } else if (normalizedPath.endsWith('.d.ts.map')) {
        // declaration maps under tmp-typings land one directory up, so their
        // source paths need rebasing
        content = remapDeclarationMapSources(path, normalizedPath, content);
      }

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

    if (!entryPoint.isSecondaryEntryPoint) {
      // the primary manifest reads every entry point, so adjust any that have
      // not been processed yet
      for (const node of graph.filter(byEntryPoint())) {
        if (node === entryPointNode) {
          continue;
        }

        const nodeEntryPoint = toCustomNgEntryPoint(node.data.entryPoint);
        node.data.entryPoint = nodeEntryPoint;
        node.data.destinationFiles = nodeEntryPoint.destinationFiles;
      }

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

export function removeSourceMappingUrl(content: string): string {
  return content.replace(/\/\/# sourceMappingURL=[^\r\n]*\s*$/, '');
}

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
  // A non-empty root is prepended to each source, so rebasing them alone is wrong.
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

export function normalizeEsm2022Path(
  path: string,
  entryPoint: NgEntryPointType
): string {
  const normalizedPath = normalize(path);
  if (!entryPoint.primaryDestinationPath) {
    return normalizedPath;
  }

  // rewrite only below the destination path, which may itself contain the segment
  const tmpEsm2022Dir =
    join(entryPoint.primaryDestinationPath, 'tmp-esm2022') + sep;
  if (normalizedPath.startsWith(tmpEsm2022Dir)) {
    return join(
      entryPoint.primaryDestinationPath,
      'esm2022',
      normalizedPath.slice(tmpEsm2022Dir.length)
    );
  }

  const tmpTypingsDir =
    join(entryPoint.primaryDestinationPath, 'tmp-typings') + sep;
  if (normalizedPath.startsWith(tmpTypingsDir)) {
    return join(
      entryPoint.primaryDestinationPath,
      normalizedPath.slice(tmpTypingsDir.length)
    );
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
