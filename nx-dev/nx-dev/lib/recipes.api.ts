import { DocumentsApi } from '@nx/nx-dev/data-access-documents/node-only';
import documents from '../public/documentation/generated/manifests/recipes.json';
import { tagsApi } from './tags.api';

export const nxRecipesApi = new DocumentsApi({
  id: 'recipes',
  manifest: documents,
  prefix: '',
  publicDocsRoot: 'public/documentation',
  tagsApi,
});
