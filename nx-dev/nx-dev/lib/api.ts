import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents/node-only';
import { MenuApi } from '@nrwl/nx-dev/data-access-menu';
import { PackagesApi } from '@nrwl/nx-dev/data-access-packages/node-only';
import { DocumentMetadata } from '@nrwl/nx-dev/models-document';

// Imports JSON directly so they can be bundled into the app and functions.
// Also provides some test safety.
import documents from '../public/documentation/map.json';
import packages from '../public/documentation/packages.json';

export const packagesApi = new PackagesApi({
  publicPackagesRoot: 'nx-dev/nx-dev/public/documentation',
  packagesIndex: packages,
});

export const documentsApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documentSources: [
    documents.find((x) => x.id === 'default'),
    documents.find((x) => x.id === 'additional-api-references'),
  ].filter((x) => !!x) as DocumentMetadata[],
});

export const menuApi = new MenuApi(
  documentsApi.getDocuments(),
  packagesApi.getPackageDocuments().itemList as DocumentMetadata[]
);
