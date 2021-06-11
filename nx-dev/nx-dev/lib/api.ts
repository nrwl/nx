import {
  DocumentMetadata,
  DocumentsApi,
  MenuApi,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

// Imports JSON directly so they can be bundled into the app and functions.
// Also provides some test safety.
import previewDocuments from '../../../docs/map.json';
import previousDocuments from '../public/documentation/previous/map.json';
import latestDocuments from '../public/documentation/latest/map.json';
import archiveVersionsData from '../public/documentation/versions.json';

export function loadDocumentsData(): Map<string, DocumentMetadata[]> {
  const map = new Map<string, DocumentMetadata[]>();
  map.set('latest', latestDocuments);
  map.set('previous', previousDocuments);
  if (process.env.VERCEL_ENV !== 'production') {
    map.set('preview', previewDocuments);
  }
  return map;
}

export function loadVersionsData(): VersionMetadata[] {
  const versions: VersionMetadata[] = archiveVersionsData;
  if (process.env.VERCEL_ENV !== 'production') {
    versions.push({
      name: 'Preview',
      id: 'preview',
      release: 'preview',
      path: 'preview',
      default: false,
      hidden: true,
    });
  }
  return versions;
}

export const documentsApi = new DocumentsApi(
  loadVersionsData(),
  loadDocumentsData()
);
export const menuApi = new MenuApi(documentsApi);
