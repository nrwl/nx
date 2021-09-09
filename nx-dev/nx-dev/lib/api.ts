import { join } from 'path';
import {
  DocumentMetadata,
  DocumentsApi,
  MenuApi,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

// Imports JSON directly so they can be bundled into the app and functions.
// Also provides some test safety.
import previousDocuments from '../public/documentation/previous/map.json';
import latestDocuments from '../public/documentation/latest/map.json';
import archiveVersionsData from '../public/documentation/versions.json';

export function loadDocumentsData(): Map<string, DocumentMetadata[]> {
  const map = new Map<string, DocumentMetadata[]>();
  map.set('latest', latestDocuments);
  map.set('previous', previousDocuments);
  return map;
}

export function loadVersionsData(): VersionMetadata[] {
  return archiveVersionsData;
}

export const documentsApi = new DocumentsApi({
  archiveRoot: join(
    process.env.NX_WORKSPACE_ROOT,
    'nx-dev/nx-dev/public/documentation'
  ),
  documentsMap: loadDocumentsData(),
  versions: loadVersionsData(),
});

export const menuApi = new MenuApi(documentsApi);
