import { describePruneLockfileForPackageManager } from './js-executor-prune-lockfile-utils';

describe('js:prune-lockfile executor', () => {
  describePruneLockfileForPackageManager('pnpm', 'pnpm-lock.yaml');
});
