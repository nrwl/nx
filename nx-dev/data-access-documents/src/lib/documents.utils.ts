import { readJsonFile } from '@nrwl/workspace';
import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

import { Item } from './documents.models';
import versionsData from '../data/versions.json';

export const documentsDataRoot = join(
  appRootPath,
  'nx-dev/data-access-documents/src/data'
);
export const documentsPreviewRoot = join(appRootPath, 'docs');

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
    return documentsPreviewRoot;
  }

  if (version === 'latest' || version === 'previous') {
    return join(
      documentsDataRoot,
      versionsData.find((x) => x.id === version).path
    );
  }

  throw new Error(`Cannot find root for ${version}`);
}
