import { convertNxExecutor } from '@nrwl/devkit';

import devServerExecutor from './dev-server.impl';

export default convertNxExecutor(devServerExecutor);
