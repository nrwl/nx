import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents/node-only';
import { MenuApi } from '@nrwl/nx-dev/data-access-menu';
import { PackagesApi } from '@nrwl/nx-dev/data-access-packages/node-only';
import {
  convertToDocumentMetadata,
  DocumentMetadata,
} from '@nrwl/nx-dev/models-document';
import {
  getBasicNxCloudSection,
  getBasicSection,
  getDeepDiveNxCloudSection,
  getBasicRecipesSection,
} from '../../data-access-menu/src/lib/menu.utils';

// Imports JSON directly, so they can be bundled into the app and functions.
// Also provides some test safety.
import documents from '../public/documentation/map.json';
import packages from '../public/documentation/packages.json';

export const packagesApi = new PackagesApi({
  publicPackagesRoot: 'nx-dev/nx-dev/public/documentation',
  packagesIndex: packages,
});
export const nxDocumentsApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documentSources: [
    documents.find(
      (x) => x.id === 'nx-documentation'
    ) as Partial<DocumentMetadata>,
    documents.find(
      (x) => x.id === 'additional-api-references'
    ) as Partial<DocumentMetadata>,
  ]
    .filter((x) => !!x)
    .map((x) => convertToDocumentMetadata(x)),
  addAncestor: null,
});
export const nxRecipesApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documentSources: [documents.find((x) => x.id === 'nx-recipes')].filter(
    (x) => !!x
  ) as DocumentMetadata[],
  addAncestor: { id: 'recipes', name: 'Recipes' },
});
export const nxCloudDocumentsApi = new DocumentsApi({
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  documentSources: [
    documents.find(
      (x) => x.id === 'nx-cloud-documentation'
    ) as Partial<DocumentMetadata>,
  ]
    .filter((x) => !!x)
    .map((x) => convertToDocumentMetadata(x)),
  addAncestor: { id: 'nx-cloud', name: 'Nx Cloud' },
});

export const nxMenuApi = new MenuApi(
  nxDocumentsApi.getDocuments(),
  packagesApi.getPackageDocuments().itemList,
  [getBasicSection]
);
export const nxRecipesMenuApi = new MenuApi(
  nxRecipesApi.getDocuments(),
  [],
  [getBasicRecipesSection]
);
export const nxCloudMenuApi = new MenuApi(
  nxCloudDocumentsApi.getDocuments(),
  [],
  [getBasicNxCloudSection, getDeepDiveNxCloudSection]
);
