/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 * - Write the ESM2022 outputs to the file system.
 * - Fake the FESM2022 outputs pointing them to the ESM2022 outputs.
 */

import type { NgEntryPoint } from 'ng-packagr/src/lib/ng-package/entry-point/entry-point';
import type { NgPackagrOptions } from 'ng-packagr/src/lib/ng-package/options.di';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { getNgPackagrVersionInfo } from '../../../../utilities/ng-packagr/ng-packagr-version';
import { importNgPackagrPath } from '../../../../utilities/ng-packagr/package-imports';
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
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { transformFromPromise } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/graph/transform')
  >('ng-packagr/src/lib/graph/transform', ngPackagrMajorVersion);
  const { isEntryPointInProgress, isPackage } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/nodes')
  >('ng-packagr/src/lib/ng-package/nodes', ngPackagrMajorVersion);
  const { NgPackage } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/ng-package/package')
  >('ng-packagr/src/lib/ng-package/package', ngPackagrMajorVersion);

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

      // Only write if content has changed
      if (await shouldWriteFile(normalizedPath, outputCache.content)) {
        await mkdir(dirname(normalizedPath), { recursive: true });
        await writeFile(normalizedPath, outputCache.content);
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
