import {
  DocumentMetadata,
  DocumentsApi,
  MenuApi,
} from '@nrwl/nx-dev/data-access-documents';

// Imports JSON directly so they can be bundled into the app and functions.
// Also provides some test safety.
import latestDocuments from '../public/documentation/latest/map.json';

export const documentsApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documents: latestDocuments.find(
    (x) => x.id === 'default'
  ) as DocumentMetadata,
});

export const menuApi = new MenuApi(documentsApi);
