import { BlogApi } from '@nx/nx-dev/data-access-documents/node-only';

export const blogApi = new BlogApi({
  id: 'blog',
  blogRoot: 'public/documentation/blog',
});
