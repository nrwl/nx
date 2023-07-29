import { convertNxExecutor } from '@nx/devkit';

import devServerExecutor from './dev-server.impl';

export default convertNxExecutor(devServerExecutor);
