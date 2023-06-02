import { DocumentsApi } from '@nx/nx-dev/data-access-documents/node-only';
import documents from '../public/documentation/generated/manifests/plugins.json';
import { tagsApi } from './tags.api';

export const nxPluginsApi = new DocumentsApi({
  id: 'plugins',
  manifest: documents,
  prefix: '',
  publicDocsRoot: 'public/documentation',
  tagsApi,
});
