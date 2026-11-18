// Must be the first import — see enable-compile-cache.ts.
import '../../utils/enable-compile-cache';
// Captures Node's .js loader before user code can hook it, see native-js-loader.ts.
import './native-js-loader';
import { output } from '../../utils/output';
import { startServer } from './server';
import * as process from 'process';

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
