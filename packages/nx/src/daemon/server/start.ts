import { output } from '../../utils/output.js';
import { startServer } from './server.js';
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
