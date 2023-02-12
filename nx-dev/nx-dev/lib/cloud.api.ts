import {
  DocumentsApi,
  TagsApi,
} from '@nrwl/nx-dev/data-access-documents/node-only';

// Imports JSON directly, so they can be bundled into the app and functions.
// Also provides some test safety.
import documents from '../public/documentation/generated/manifests/cloud.json';
import tags from '../public/documentation/generated/manifests/tags.json';

export const nxCloudApi = new DocumentsApi({
  id: 'cloud',
  manifest: documents,
  prefix: '',
  publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
  tagsApi: new TagsApi(tags),
});
