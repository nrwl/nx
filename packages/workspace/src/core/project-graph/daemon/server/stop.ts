import { output } from '../../../../utilities/output';
import { safelyCleanUpExistingProcess } from '../cache';
import { stopServer } from './server';

(async () => {
  try {
    await stopServer();
    await safelyCleanUpExistingProcess();
  } catch (err) {
    output.error({
      title:
        err?.message ||
        'Something unexpected went wrong when stopping the server',
    });
  }
})();
