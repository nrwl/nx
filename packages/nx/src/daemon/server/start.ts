// Must be the first import — see enable-compile-cache.ts.
import '../../utils/enable-compile-cache';
import { output } from '../../utils/output';
import { startServer } from './server';
import { releaseDaemonStartLock } from './start-lock';
import * as process from 'process';

(async () => {
  try {
    await startServer();
  } catch (err) {
    // startServer holds the start lock until it listens, and this exit is the
    // one way out of that span the server module cannot clean up after.
    releaseDaemonStartLock(true);
    output.error({
      title:
        err?.message ||
        'Something unexpected went wrong when starting the server',
    });
    process.exit(1);
  }
})();
