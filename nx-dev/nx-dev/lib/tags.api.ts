import { TagsApi } from '@nx/nx-dev/data-access-documents/node-only';
import tags from '../public/documentation/generated/manifests/tags.json';

export const tagsApi = new TagsApi(tags);
