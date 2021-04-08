import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import archivedVersions from '@nrwl/nx-dev/archive/versions.json';

export const archiveRootPath = join(appRootPath, 'nx-dev/archive');
export const previewRootPath = join(appRootPath, 'docs');

export function getVersionRootPath(version: string): string {
  if (version === 'preview') {
    return previewRootPath;
  }

  if (version === 'latest' || version === 'previous') {
    return join(
      archiveRootPath,
      archivedVersions.find((x) => x.id === version).path
    );
  }

  throw new Error(`Cannot find root for ${version}`);
}
