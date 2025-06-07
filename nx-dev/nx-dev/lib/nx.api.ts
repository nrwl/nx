import { DocumentsApi } from '@nx/nx-dev-data-access-documents/node-only';
import documents from '../public/documentation/generated/manifests/nx.json';
import packages from '../public/documentation/generated/manifests/new-nx-api.json';
import { tagsApi } from './tags.api';
import { type ProcessedPackageMetadata } from '@nx/nx-dev-models-package';

export const nxDocumentationApi = new DocumentsApi({
  id: 'nx',
  manifest: documents,
  packagesManifest: packages as Record<string, ProcessedPackageMetadata>,
  prefix: '',
  publicDocsRoot: 'public/documentation',
  tagsApi,
});
