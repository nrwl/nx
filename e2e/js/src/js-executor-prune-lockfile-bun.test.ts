import { describePruneLockfileForPackageManager } from './js-executor-prune-lockfile-utils';

describe('js:prune-lockfile executor', () => {
  describePruneLockfileForPackageManager('bun', 'bun.lock');
});
