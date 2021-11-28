import { convertNxExecutor } from '@nrwl/devkit';

import buildStatusExecutor from './build-status.impl';

export default convertNxExecutor(buildStatusExecutor);
