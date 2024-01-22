import { ChangelogApi } from '@nx/nx-dev/data-access-documents/node-only';

export const changeLogApi = new ChangelogApi({
  id: 'changelog',
  changelogRoot: 'public/documentation/changelog',
});
