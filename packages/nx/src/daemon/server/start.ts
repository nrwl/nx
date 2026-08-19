// Must be the first import — see enable-compile-cache.ts.
import '../../utils/enable-compile-cache';
import {
  ensureCjsResolverPatched,
  ensureNodeNextEsmResolverRegistered,
  isNativeStripPreferred,
} from '../../plugins/js/utils/register';
import { output } from '../../utils/output';
import { startServer } from './server';
import * as process from 'process';

// The daemon is spawned with the workspace's resolve conditions (see
// startInBackground in client.ts), so in-process sync generator imports can
// reach workspace TypeScript source. Register the NodeNext `.js` -> `.ts`
// resolvers up front — plugin workers get them via registerPluginTSTranspiler,
// but nothing else registers them in this process before a generator loads.
if (isNativeStripPreferred()) {
  ensureCjsResolverPatched();
  ensureNodeNextEsmResolverRegistered();
}

(async () => {
  try {
    await startServer();
  } catch (err) {
    output.error({
      title:
        err?.message ||
        'Something unexpected went wrong when starting the server',
    });
    process.exit(1);
  }
})();
