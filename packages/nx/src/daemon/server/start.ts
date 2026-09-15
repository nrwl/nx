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
    // startServer holds the start lock from its first line until the server is
    // listening, and this exit is the one way out of that span that the server
    // module cannot clean up after. Left behind, the file is settled by the
    // liveness of the pid written in it, so it goes stale on pid reuse and
    // stalls every later start for the whole acquire budget.
    releaseDaemonStartLock(true);
    output.error({
      title:
        err?.message ||
        'Something unexpected went wrong when starting the server',
    });
    process.exit(1);
  }
})();
