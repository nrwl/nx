import { convertNxExecutor } from '@nx/devkit';

import syncDepsExecutor from './sync-deps.impl';

export default convertNxExecutor(syncDepsExecutor);
