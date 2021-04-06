import { readJsonFile } from '@nrwl/workspace';
import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

import { Item, VersionData } from './models';
import versionsData from '../data/versions.json';

const dataRoot = join(appRootPath, 'nx-dev/data-access-documents/src/data');
const previewRoot = join(appRootPath, 'docs');

const mapCache = new Map<string, Item[]>();
export function getDocumentsMap(version: string) {
  try {
    let map = mapCache.get(version);
    if (!map) {
      map = readJsonFile(join(getDocumentsRoot(version), 'map.json'));
      mapCache.set(version, map);
    }
    return map;
  } catch {
    throw new Error(`Cannot find map.json for ${version}`);
  }
}

export function getDocumentsRoot(version: string): string {
  if (version === 'preview') {
    return previewRoot;
  }

  if (version === 'latest' || version === 'previous') {
    return join(dataRoot, versionsData.find((x) => x.id === version).path);
  }

  throw new Error(`Cannot find root for ${version}`);
}

let versions: VersionData[];
export function getVersions(): VersionData[] {
  if (!versions) {
    versions = readJsonFile(join(dataRoot, 'versions.json'));
  }
  return versions;
}
