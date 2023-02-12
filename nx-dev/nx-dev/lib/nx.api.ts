import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents/node-only';
import documents from '../public/documentation/generated/manifests/nx.json';
import { tagsApi } from './tags.api';

export const nxDocumentationApi = new DocumentsApi({
  id: 'nx',
  manifest: documents,
  prefix: '',
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  tagsApi,
});
