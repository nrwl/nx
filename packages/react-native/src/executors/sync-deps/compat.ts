import { convertNxExecutor } from '@nrwl/devkit';

import syncDepsExecutor from './sync-deps.impl';

export default convertNxExecutor(syncDepsExecutor);
