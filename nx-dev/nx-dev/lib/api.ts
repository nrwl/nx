import {
  DocumentMetadata,
  DocumentsApi,
  FlavorMetadata,
  MenuApi,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

// Imports JSON directly so they can be bundled into the app and functions.
// Also provides some test safety.
import previousDocuments from '../public/documentation/previous/map.json';
import latestDocuments from '../public/documentation/latest/map.json';
import flavorsData from '../public/documentation/flavors.json';
import versionsData from '../public/documentation/versions.json';

export function loadDocumentsData(): Map<string, DocumentMetadata[]> {
  const map = new Map<string, DocumentMetadata[]>();
  map.set('latest', latestDocuments);
  map.set('previous', previousDocuments);
  return map;
}

export function loadFlavorsData(): FlavorMetadata[] {
  return flavorsData;
}
export function loadVersionsData(): VersionMetadata[] {
  return versionsData;
}

export const documentsApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documentsMap: loadDocumentsData(),
  flavors: loadFlavorsData(),
  versions: loadVersionsData(),
});

export const menuApi = new MenuApi(documentsApi);
